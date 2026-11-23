<script lang="ts">
	/**
	 * A video room in the browser: RealtimeKit's ready-made meeting
	 * (Cloudflare, "RealtimeKit UI Kit"), loaded only once someone has agreed to
	 * the recording notice and been given a token, so other pages never carry
	 * it. People join with their camera and microphone off and turn them on in
	 * the setup screen if they want.
	 *
	 * Recording is never silent: while one runs, a banner says so and screen
	 * readers are told; a short rising tone plays when it starts and a falling
	 * one when it stops, as in Magna Carta's meetings. Hosts get a start and
	 * stop button when everyone was told the room is, or may be, recorded.
	 */
	import { onMount } from 'svelte';
	import Circle from '@lucide/svelte/icons/circle';
	import Square from '@lucide/svelte/icons/square';
	import type { RecordingChoice } from '#lib/event-calendar.ts';

	interface Props {
		token: string;
		host: boolean;
		/** What everyone was told about recording before joining. Hosts may record unless it was "not recorded". */
		told: RecordingChoice;
	}

	let { token, host, told }: Props = $props();
	const mayRecord = $derived(told !== 'not-recorded');

	let container: HTMLDivElement | undefined = $state();
	let loading = $state(true);
	let failed = $state('');
	let recording = $state(false);
	let busy = $state(false);
	let announcement = $state('');

	type RecordingState = 'IDLE' | 'STARTING' | 'RECORDING' | 'PAUSED' | 'STOPPING';
	interface RoomRecording {
		recordingState: RecordingState;
		start(): Promise<void>;
		stop(): Promise<void>;
		on(event: 'recordingUpdate', listener: (state: RecordingState) => void): unknown;
		off?(event: 'recordingUpdate', listener: (state: RecordingState) => void): unknown;
	}
	interface RoomMeeting {
		recording: RoomRecording;
		leave(): Promise<void>;
	}

	let meeting: RoomMeeting | undefined;

	/** Two short notes, rising for a start and falling for a stop. */
	function tone(starting: boolean) {
		try {
			const AudioContextClass = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
			if (!AudioContextClass) return;
			const context = new AudioContextClass();
			const notes = starting ? [660, 880] : [880, 660];
			notes.forEach((frequency, index) => {
				const oscillator = context.createOscillator();
				const gain = context.createGain();
				oscillator.frequency.value = frequency;
				const begins = context.currentTime + index * 0.22;
				gain.gain.setValueAtTime(0.0001, begins);
				gain.gain.exponentialRampToValueAtTime(0.15, begins + 0.02);
				gain.gain.exponentialRampToValueAtTime(0.0001, begins + 0.18);
				oscillator.connect(gain).connect(context.destination);
				oscillator.start(begins);
				oscillator.stop(begins + 0.2);
			});
			setTimeout(() => void context.close(), 800);
		} catch {
			// No sound is possible here; the banner still shows.
		}
	}

	function onRecordingState(state: RecordingState) {
		const now = state === 'RECORDING';
		if (now === recording) return;
		recording = now;
		tone(now);
		announcement = now ? 'Recording has started.' : 'Recording has stopped.';
	}

	async function toggleRecording() {
		if (!meeting) return;
		busy = true;
		try {
			if (recording) await meeting.recording.stop();
			else await meeting.recording.start();
		} catch {
			announcement = recording ? 'The recording could not be stopped. Try again.' : 'The recording could not be started. Try again.';
		} finally {
			busy = false;
		}
	}

	onMount(() => {
		let stopped = false;
		void (async () => {
			try {
				const [{ default: RealtimeKitClient }, { defineCustomElement }] = await Promise.all([
					import('@cloudflare/realtimekit'),
					import('@cloudflare/realtimekit-ui/components/rtk-meeting')
				]);
				defineCustomElement();
				if (stopped || !container) return;
				const client = (await RealtimeKitClient.init({ authToken: token, defaults: { audio: false, video: false } })) as unknown as RoomMeeting;
				if (stopped) {
					await client.leave().catch(() => undefined);
					return;
				}
				meeting = client;
				const element = document.createElement('rtk-meeting') as HTMLElement & { meeting: unknown; showSetupScreen: boolean };
				element.showSetupScreen = true;
				element.meeting = client;
				container.append(element);
				recording = client.recording.recordingState === 'RECORDING';
				client.recording.on('recordingUpdate', onRecordingState);
				loading = false;
			} catch (problem) {
				console.error('The video room did not load', problem);
				failed = 'The video room did not load. Check your connection and reload the page.';
				loading = false;
			}
		})();
		return () => {
			stopped = true;
			meeting?.recording.off?.('recordingUpdate', onRecordingState);
			void meeting?.leave().catch(() => undefined);
		};
	});
</script>

<div class="room">
	<p class="visually-hidden" aria-live="assertive">{announcement}</p>
	{#if recording}
		<p class="recording-banner" role="status"><Circle size={14} strokeWidth={0} fill="currentColor" aria-hidden="true" /> This room is being recorded</p>
	{/if}
	{#if host && !loading && !failed}
		<div class="host-bar">
			{#if mayRecord || recording}
				<button class="button button-quiet" type="button" onclick={toggleRecording} disabled={busy}>
					{#if recording}<Square size={18} strokeWidth={1.75} /> Stop recording{:else}<Circle size={18} strokeWidth={1.75} /> Start recording{/if}
				</button>
			{/if}
			<p class="hint">
				{#if told === 'recorded'}
					Everyone was told this room is recorded. Start recording when you begin.
				{:else if told === 'undecided'}
					Everyone was told this room may be recorded. If you record, say so out loud when you start.
				{:else}
					Everyone was told this room is not recorded, so do not record it.
				{/if}
			</p>
		</div>
	{/if}
	{#if loading}
		<p class="muted" role="status">Opening the room…</p>
	{/if}
	{#if failed}
		<div class="notice notice-problem" role="alert"><p>{failed}</p></div>
	{/if}
	<div class="stage" bind:this={container}></div>
</div>

<style>
	.room {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}

	.recording-banner {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		margin: 0;
		padding: var(--space-2) var(--space-3);
		border: 1px solid var(--color-danger);
		border-radius: var(--radius-panel);
		color: var(--color-danger);
		font-weight: 600;
	}

	.host-bar {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-3);
	}

	.host-bar .hint {
		margin: 0;
	}

	.button {
		gap: var(--space-2);
	}

	.stage {
		height: min(80vh, 48rem);
		min-height: 24rem;
		border: 1px solid var(--color-line);
		border-radius: var(--radius-panel);
		overflow: hidden;
	}

	.stage:empty {
		display: none;
	}
</style>
