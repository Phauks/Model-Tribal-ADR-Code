<!-- The search box and the live count. Shown only once scripts run, so a
     reader without scripts never meets a control that does nothing. -->
<script>
  let { identifier, label, value = $bindable(''), shownCount, totalCount } = $props();
</script>

<div class="table-tools">
  <div>
    <label for="{identifier}-search">{label}</label>
    <input id="{identifier}-search" type="search" bind:value autocomplete="off" />
  </div>
  <p class="table-status" role="status" aria-live="polite">Showing {shownCount} of {totalCount}</p>
</div>
