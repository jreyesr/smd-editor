<script lang="ts">
    import type {PageProps} from './$types';
    import {createDesign, type StoredDesign} from "$lib/store";
    import {goto} from "$app/navigation";

    let {data}: PageProps = $props();

    async function addDesign() {
        const newId = await createDesign()
        goto("/editor/" + newId)
    }
</script>

{#snippet designCard(designData: StoredDesign)}
    <button onclick={() => goto(`/editor/${designData.id}`)} class="design-card">
        {designData.name} <small>({designData.data.length} elements)</small>
    </button>
{/snippet}

<h1>List of designs</h1>

<div class="cards-container">
    <button onclick={addDesign} class="design-card new-design">
        + Create new design...
    </button>

    {#if data.designs.length > 0}

        {#each data.designs as design}
            {@render designCard(design)}
        {/each}
    {/if}
</div>

<style>
    .cards-container {
        display: flex;
        flex-direction: row;
        justify-content: center;
        gap: 1em;
    }

    .design-card {
        background-color: gray;
        flex-basis: 50%;
        padding: 2em;
        text-align: center;
        align-content: center;
        cursor: pointer;
    }

    .new-design {
        flex-basis: 50%;
        border: 2px dashed gray;
        text-decoration: none;
        text-decoration-color: unset;
        background-color: white;
    }
</style>