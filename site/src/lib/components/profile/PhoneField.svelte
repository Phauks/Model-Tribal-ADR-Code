<!--
	A phone number with its country (Trevor, Nov. 23, 2026: "phone number
	should only accept numbers, and should have country code and formatting
	functionality"). The country sets the calling code; the number box takes
	digits only and spaces them as the country writes them, using
	libphonenumber-js (MIT), the JavaScript port of Google's libphonenumber
	(https://gitlab.com/catamphetamine/libphonenumber-js). The server reads the
	same two values and stores the number in E.164 form.
-->
<script lang="ts">
	import { AsYouType, getCountries, getCountryCallingCode, type CountryCode } from 'libphonenumber-js/min';
	import SearchableDropdown, { type SearchableChoice } from '#lib/components/SearchableDropdown.svelte';

	let {
		name,
		label,
		country = $bindable('US'),
		digits = $bindable(''),
		invalid = false,
		describedBy
	}: {
		/** The fields are sent as <name>Country and <name>Number. */
		name: string;
		label: string;
		country?: string;
		digits?: string;
		invalid?: boolean;
		describedBy?: string;
	} = $props();

	const regionNames = new Intl.DisplayNames(['en-US'], { type: 'region' });

	/** Every country libphonenumber knows, by its English name, the United States first. */
	const countries: SearchableChoice<string>[] = getCountries()
		.map((code) => ({
			value: code as string,
			label: `${regionNames.of(code) ?? code} +${getCountryCallingCode(code)}`,
			keywords: [code, `+${getCountryCallingCode(code)}`]
		}))
		.sort((first, second) => (first.value === 'US' ? -1 : second.value === 'US' ? 1 : first.label.localeCompare(second.label, 'en-US')));

	/** The digits spaced as the country writes them, such as (702) 555-0134. */
	const formatted = $derived(digits ? new AsYouType(country as CountryCode).input(digits) : '');

	function onInput(event: Event): void {
		const box = event.currentTarget as HTMLInputElement;
		digits = box.value.replace(/\D/g, '').slice(0, 15);
		box.value = formatted;
	}
</script>

<div class="phone-field">
	<div class="phone-country">
		<SearchableDropdown
			label="{label}: country"
			hideLabel
			name="{name}Country"
			choices={countries}
			value={country}
			onchange={(value) => (country = value)}
		/>
	</div>
	<input
		type="text"
		class="phone-number"
		name="{name}Number"
		inputmode="numeric"
		autocomplete="tel-national"
		aria-label="{label}: number"
		aria-invalid={invalid ? 'true' : undefined}
		aria-describedby={describedBy}
		value={formatted}
		oninput={onInput}
	/>
</div>

<style>
	.phone-field {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
	}

	.phone-country {
		flex: 0 1 15rem;
		min-width: 11rem;
	}

	.phone-number {
		flex: 1 1 10rem;
		max-width: 14rem;
		font-variant-numeric: tabular-nums;
	}
</style>
