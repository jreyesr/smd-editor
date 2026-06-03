<script>
	let { children } = $props();
</script>

{@render children()}

<style>
    :global(body) {
        font-family: sans-serif;
    }
</style>