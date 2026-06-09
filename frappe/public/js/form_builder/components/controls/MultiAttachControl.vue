<!-- Used as Multi Attach Control preview in Form Builder -->
<script setup>
const props = defineProps(["df"]);
</script>

<template>
	<div class="control editable">
		<div class="field-controls">
			<slot name="label" />
			<slot name="actions" />
		</div>
		<button class="btn btn-sm btn-default">{{ __("Attach") }}</button>
		<p v-if="df.max_attachments" class="text-muted small mt-1">
			{{ __("Max {0} files", [df.max_attachments || 5]) }}
		</p>
		<div v-if="df.description" class="mt-2 description" v-html="df.description"></div>
	</div>
</template>
