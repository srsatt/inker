/**
 * Widget-related constants
 */

/**
 * Offset used for custom widget virtual template IDs
 * Custom widgets get IDs: CUSTOM_WIDGET_TEMPLATE_OFFSET + customWidget.id
 * This prevents collision with built-in template IDs (typically 1-100)
 */
export const CUSTOM_WIDGET_TEMPLATE_OFFSET = 10000;

/**
 * Offset used for plugin virtual template IDs
 * Installed plugins get IDs: PLUGIN_TEMPLATE_OFFSET + plugin.id
 */
export const PLUGIN_TEMPLATE_OFFSET = 20000;
