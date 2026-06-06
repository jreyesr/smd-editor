<script lang="ts">
    import type {PageProps} from './$types';
    import {createDesign, deleteDesign as deleteDesignStore, type StoredDesign} from "$lib/store";
    import {goto, invalidateAll} from "$app/navigation";

    let {data}: PageProps = $props();

    async function addDesign() {
        const newId = await createDesign()
        goto("/editor/" + newId)
    }

    async function deleteDesign(id: string) {
        if (confirm("Are you sure you want to delete this design?")) {
            await deleteDesignStore(id)
            await invalidateAll()
        }
    }
</script>

{#snippet designCard(designData: StoredDesign)}
    <li class="design-card">
        {#if designData.thumbnail}
            <img class="thumbnail" src={designData.thumbnail} alt={"thumbnail for design " + designData.name}/>
        {/if}
        <div class="design-card-content">
            <div class="design-card-text">
                <p class="card-title"><a class="card-primary-action"
                                         href={`/editor/${designData.id}`}>{designData.name}</a>
                    <small>({designData.data.filter(el => el.type.startsWith("device/")).length}
                        elements)</small>
                    <button class="lucide--trash card-secondary-action"
                            onclick={()=>deleteDesign(designData.id.toString())}
                            title="Delete Design"></button>
                </p>
            </div>
        </div>
    </li>
{/snippet}

<h1>Your designs</h1>

<ul class="cards-container">
    {#if data.designs.length > 0}
        {#each data.designs as design}
            {@render designCard(design)}
        {/each}
    {/if}

    <li class="design-card new-design">
        <div class="design-card-content">
            <p class="card-title">
                <button class="card-primary-action"
                        onclick={addDesign}> + Create new design...
                </button>
            </p>
        </div>
    </li>
</ul>

<style>
    .cards-container {
        display: flex;
        flex-flow: row wrap;
        justify-content: center;
        gap: 1em;

        /* reset ul styles */
        list-style: none;
        padding-left: 0;
        margin: 0;
    }

    /* accessible(ish?) cards from https://kittygiraudel.com/2022/04/02/accessible-cards/ */
    .design-card {
        background-color: lightcyan;
        flex-basis: 31%;
        max-width: 31%;
        padding: 0;
        text-align: center;
        align-content: center;
        font-size: 1.2em;
        position: relative;
        min-height: 5em;

        & .card-primary-action {
            text-decoration: none; /* reset a styles */
            color: black;
        }

        & p.card-title {
            margin-block: 0;
        }

        & .thumbnail {
            z-index: 0;
            width: 100%;
        }

        & .design-card-text {
            position: absolute;
            bottom: 0;
            left: 0;
            right: 0;
            padding: 0.5em;
            text-align: start;
            background-color: color-mix(in srgb, gray, transparent 30%);
            transition: padding-bottom 0.1s;

            &:hover {
                padding-bottom: 0.7em;
            }
        }

        & .card-primary-action::before {
            content: "";
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            border: 2px solid transparent;
            cursor: pointer;
        }

        & .card-secondary-action {
            z-index: 2;
            position: relative;
            cursor: pointer;
        }
    }

    @media (max-width: 768px) {
        .design-card {
            flex-basis: 100%;
            max-width: 100%;
        }
    }

    .new-design {
        border: 2px dashed gray;
        background-color: white;

        &:hover {
            background-color: whitesmoke;
        }

        & .card-primary-action {
            border: unset;
            background-color: unset;
            font-size: unset;
        }
    }

    .lucide--trash {
        display: inline-block;
        width: 1.5em;
        height: 1.5em;
        --svg: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='none' stroke='black' stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2'/%3E%3C/svg%3E");
        background-color: currentColor;
        -webkit-mask-image: var(--svg);
        mask-image: var(--svg);
        -webkit-mask-repeat: no-repeat;
        mask-repeat: no-repeat;
        -webkit-mask-size: 100% 100%;
        mask-size: 100% 100%;

        &:hover {
            color: red;
        }
    }
</style>