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
        {designData.name} <small>({designData.data.filter(el => el.type.startsWith("device/")).length} elements)</small>
        {#if designData.thumbnail}
            <img class="thumbnail" src={designData.thumbnail} alt={"thumbnail for design " + designData.name}/>
        {/if}
    </button>
{/snippet}

<h1>Your designs</h1>

<div class="cards-container">
    {#if data.designs.length > 0}
        {#each data.designs as design}
            {@render designCard(design)}
        {/each}
    {/if}

    <button onclick={addDesign} class="design-card new-design">
        + Create new design...
    </button>

</div>

<style>
    .cards-container {
        display: flex;
        flex-flow: row wrap;
        justify-content: center;
        gap: 1em;
    }

    .design-card {
        background-color: lightcyan;
        flex-basis: 32%;
        max-width: 32%;
        padding: 2em;
        text-align: center;
        align-content: center;
        cursor: pointer;
        font-size: 1.2em;

        & .thumbnail {
            width: 100%;
        }
    }

    .new-design {
        border: 2px dashed gray;
        text-decoration: none;
        text-decoration-color: unset;
        background-color: white;
    }
</style>