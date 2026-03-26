/**
 * TRMNL CSS Framework for Plugin Rendering
 *
 * Comprehensive CSS matching TRMNL's utility class system for e-ink displays.
 * Based on TRMNL framework documentation and plugin template analysis.
 */

export const TRMNL_CSS = `
/* ============================
   TRMNL Framework CSS for Inker
   ============================ */

/* Reset */
* { margin: 0; padding: 0; box-sizing: border-box; }

/* Root */
body {
  font-family: 'Inter', 'Helvetica Neue', Arial, sans-serif;
  background: #fff;
  color: #000;
  overflow: hidden;
  -webkit-font-smoothing: antialiased;
}

/* Screen container */
.screen { width: 100%; height: 100%; position: relative; }

/* View container */
.view { width: 100%; height: 100%; display: flex; flex-direction: column; position: relative; }
.view--full { width: 100%; height: 100%; }
.view--half_horizontal { width: 100%; height: 100%; }
.view--half_vertical { width: 100%; height: 100%; }
.view--quadrant { width: 100%; height: 100%; }

/* Layout */
.layout { flex: 1; display: flex; flex-direction: column; padding: 16px; overflow: hidden; }
.layout--row { flex-direction: row; }
.layout--col { flex-direction: column; }
.layout--left { align-items: flex-start; }
.layout--center-x { align-items: center; }
.layout--right { align-items: flex-end; }
.layout--top { justify-content: flex-start; }
.layout--center-y { justify-content: center; }
.layout--bottom { justify-content: flex-end; }
.layout--stretch { align-items: stretch; justify-content: stretch; }
.layout--stretch-x { align-items: stretch; }
.layout--stretch-y { justify-content: stretch; }

/* Flex */
.flex { display: flex; }
.flex--row { flex-direction: row; }
.flex--col { flex-direction: column; }
.flex--wrap { flex-wrap: wrap; }
.flex--left { justify-content: flex-start; }
.flex--center-x { justify-content: center; }
.flex--right { justify-content: flex-end; }
.flex--top { align-items: flex-start; }
.flex--center-y { align-items: center; }
.flex--bottom { align-items: flex-end; }
.flex--stretch { align-items: stretch; }
.flex--between { justify-content: space-between; }
.flex--around { justify-content: space-around; }
.flex--evenly { justify-content: space-evenly; }
.flex--row-reverse { flex-direction: row-reverse; }
.flex--col-reverse { flex-direction: column-reverse; }

/* Grid */
.grid { display: grid; }
.grid--cols-1 { grid-template-columns: repeat(1, 1fr); }
.grid--cols-2 { grid-template-columns: repeat(2, 1fr); }
.grid--cols-3 { grid-template-columns: repeat(3, 1fr); }
.grid--cols-4 { grid-template-columns: repeat(4, 1fr); }
.grid--cols-5 { grid-template-columns: repeat(5, 1fr); }
.grid--cols-6 { grid-template-columns: repeat(6, 1fr); }
.grid--cols-7 { grid-template-columns: repeat(7, 1fr); }
.grid--cols-8 { grid-template-columns: repeat(8, 1fr); }
.grid--cols-9 { grid-template-columns: repeat(9, 1fr); }
.grid--cols-10 { grid-template-columns: repeat(10, 1fr); }
.grid--cols-11 { grid-template-columns: repeat(11, 1fr); }
.grid--cols-12 { grid-template-columns: repeat(12, 1fr); }
.grid--wrap { grid-auto-flow: row; }
.col--span-1 { grid-column: span 1; }
.col--span-2 { grid-column: span 2; }
.col--span-3 { grid-column: span 3; }
.col--span-4 { grid-column: span 4; }
.col--span-5 { grid-column: span 5; }
.col--span-6 { grid-column: span 6; }
.col--span-7 { grid-column: span 7; }
.col--span-8 { grid-column: span 8; }
.col--span-9 { grid-column: span 9; }
.col--span-10 { grid-column: span 10; }
.col--span-11 { grid-column: span 11; }
.col--span-12 { grid-column: span 12; }

/* Columns */
.columns { display: flex; flex-wrap: wrap; gap: 8px; }
.column { flex: 1; min-width: 0; }

/* Gaps */
.gap--none { gap: 0; }
.gap--xsmall { gap: 2px; }
.gap--small { gap: 4px; }
.gap { gap: 8px; }
.gap--medium { gap: 12px; }
.gap--large { gap: 16px; }
.gap--xlarge { gap: 24px; }
.gap--xxlarge { gap: 32px; }
.gap--auto { gap: auto; }
.gap--distribute, .gap--space-between { justify-content: space-between; }

/* Margins */
.m--none { margin: 0; }
.m--xsmall { margin: 2px; }
.m--small { margin: 4px; }
.m--base { margin: 8px; }
.m--medium { margin: 12px; }
.m--large { margin: 16px; }
.m--xlarge { margin: 24px; }
.m--xxlarge { margin: 32px; }
.mt--small { margin-top: 4px; } .mt--base { margin-top: 8px; } .mt--medium { margin-top: 12px; } .mt--large { margin-top: 16px; }
.mb--small { margin-bottom: 4px; } .mb--base { margin-bottom: 8px; } .mb--medium { margin-bottom: 12px; } .mb--large { margin-bottom: 16px; }
.ml--small { margin-left: 4px; } .ml--base { margin-left: 8px; } .ml--medium { margin-left: 12px; } .ml--large { margin-left: 16px; }
.mr--small { margin-right: 4px; } .mr--base { margin-right: 8px; } .mr--medium { margin-right: 12px; } .mr--large { margin-right: 16px; }
.mx--small { margin-left: 4px; margin-right: 4px; } .mx--base { margin-left: 8px; margin-right: 8px; }
.my--small { margin-top: 4px; margin-bottom: 4px; } .my--base { margin-top: 8px; margin-bottom: 8px; }

/* Padding */
.p--none { padding: 0; }
.p--xsmall { padding: 2px; }
.p--small { padding: 4px; }
.p--base { padding: 8px; }
.p--medium { padding: 12px; }
.p--large { padding: 16px; }
.p--xlarge { padding: 24px; }
.p--xxlarge { padding: 32px; }
.pt--small { padding-top: 4px; } .pt--base { padding-top: 8px; } .pt--medium { padding-top: 12px; } .pt--large { padding-top: 16px; }
.pb--small { padding-bottom: 4px; } .pb--base { padding-bottom: 8px; } .pb--medium { padding-bottom: 12px; } .pb--large { padding-bottom: 16px; }
.pl--small { padding-left: 4px; } .pl--base { padding-left: 8px; } .pl--medium { padding-left: 12px; } .pl--large { padding-left: 16px; }
.pr--small { padding-right: 4px; } .pr--base { padding-right: 8px; } .pr--medium { padding-right: 12px; } .pr--large { padding-right: 16px; }
.px--small { padding-left: 4px; padding-right: 4px; } .px--base { padding-left: 8px; padding-right: 8px; }
.py--small { padding-top: 4px; padding-bottom: 4px; } .py--base { padding-top: 8px; padding-bottom: 8px; }

/* Typography */
.title { font-size: 24px; font-weight: 700; line-height: 1.2; }
.title--small { font-size: 18px; font-weight: 700; line-height: 1.2; }
.label { font-size: 12px; font-weight: 500; line-height: 1.3; }
.label--small { font-size: 10px; font-weight: 500; line-height: 1.3; }
.label--underline { text-decoration: underline; }
.label--gray-out { opacity: 0.5; }
.description { font-size: 14px; line-height: 1.4; }
.index { font-size: 12px; font-weight: 700; opacity: 0.5; min-width: 20px; }

/* Values (metrics) */
.value { font-size: 32px; font-weight: 700; line-height: 1.1; }
.value--xxxlarge { font-size: 72px; font-weight: 700; line-height: 1; }
.value--xxlarge { font-size: 56px; font-weight: 700; line-height: 1; }
.value--xlarge { font-size: 48px; font-weight: 700; line-height: 1; }
.value--large { font-size: 40px; font-weight: 700; line-height: 1.1; }
.value--base { font-size: 32px; font-weight: 700; line-height: 1.1; }
.value--small { font-size: 24px; font-weight: 700; line-height: 1.2; }
.value--xsmall { font-size: 18px; font-weight: 700; line-height: 1.2; }
.value--xxsmall { font-size: 14px; font-weight: 700; line-height: 1.3; }

/* Text utilities */
.text--left { text-align: left; }
.text--center { text-align: center; }
.text--right { text-align: right; }
.text--justify { text-align: justify; }
.text--black { color: #000; }
.text--white { color: #fff; }
.text--gray-10 { color: #1a1a1a; }
.text--gray-20 { color: #333; }
.text--gray-30 { color: #4d4d4d; }
.text--gray-40 { color: #666; }
.text--gray-50 { color: #808080; }
.text--gray-55 { color: #8c8c8c; }
.text--gray-60 { color: #999; }
.text--gray-70 { color: #b3b3b3; }
.text--gray-75 { color: #bfbfbf; }

/* Sizing */
.w--full { width: 100%; }
.h--full { height: 100%; }
.w--auto { width: auto; }
.h--auto { height: auto; }
.w--0 { width: 0; } .w--1 { width: 4px; } .w--2 { width: 8px; } .w--3 { width: 12px; } .w--4 { width: 16px; }
.w--5 { width: 20px; } .w--6 { width: 24px; } .w--7 { width: 28px; } .w--8 { width: 32px; }
.w--10 { width: 40px; } .w--12 { width: 48px; } .w--16 { width: 64px; } .w--20 { width: 80px; }
.w--24 { width: 96px; } .w--32 { width: 128px; } .w--40 { width: 160px; } .w--48 { width: 192px; }
.h--0 { height: 0; } .h--1 { height: 4px; } .h--2 { height: 8px; } .h--3 { height: 12px; } .h--4 { height: 16px; }
.h--5 { height: 20px; } .h--6 { height: 24px; } .h--7 { height: 28px; } .h--8 { height: 32px; }
.h--10 { height: 40px; } .h--12 { height: 48px; } .h--16 { height: 64px; } .h--20 { height: 80px; }

/* Background colors */
.bg-black, .bg--black { background-color: #000; }
.bg-white, .bg--white { background-color: #fff; }
.bg--gray-5 { background-color: #f2f2f2; }
.bg--gray-10 { background-color: #e6e6e6; }
.bg--gray-15 { background-color: #d9d9d9; }
.bg--gray-20 { background-color: #ccc; }
.bg--gray-25 { background-color: #bfbfbf; }
.bg--gray-30 { background-color: #b3b3b3; }
.bg--gray-35 { background-color: #a6a6a6; }
.bg--gray-40 { background-color: #999; }
.bg--gray-45 { background-color: #8c8c8c; }
.bg--gray-50 { background-color: #808080; }
.bg--gray-55 { background-color: #737373; }
.bg--gray-60 { background-color: #666; }
.bg--gray-65 { background-color: #595959; }
.bg--gray-70 { background-color: #4d4d4d; }
.bg--gray-75 { background-color: #404040; }

/* Borders */
.border--h-1 { border-top: 1px solid #000; border-bottom: 1px solid #000; }
.border--h-2 { border-top: 1px solid #333; border-bottom: 1px solid #333; }
.border--h-3 { border-top: 1px solid #666; border-bottom: 1px solid #666; }
.border--h-4 { border-top: 1px solid #999; border-bottom: 1px solid #999; }
.border--h-5 { border-top: 1px solid #ccc; border-bottom: 1px solid #ccc; }
.border--v-1 { border-left: 1px solid #000; border-right: 1px solid #000; }
.border--v-2 { border-left: 1px solid #333; border-right: 1px solid #333; }
.b-h-gray-5 { border-bottom: 1px solid #e6e6e6; }

/* Border radius */
.rounded--none { border-radius: 0; }
.rounded--xsmall { border-radius: 2px; }
.rounded--small { border-radius: 4px; }
.rounded { border-radius: 6px; }
.rounded--medium { border-radius: 8px; }
.rounded--large { border-radius: 12px; }
.rounded--xlarge { border-radius: 16px; }
.rounded--xxlarge { border-radius: 24px; }
.rounded--full { border-radius: 9999px; }

/* Divider */
.divider { border-top: 2px solid #000; width: 100%; }

/* Title bar (plugin footer/header) */
.title_bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  border-top: 2px solid #000;
  font-size: 12px;
}
.title_bar .image { width: 20px; height: 20px; }
.title_bar .title { font-weight: 700; }
.title_bar .instance { opacity: 0.5; margin-left: auto; }

/* Item component */
.item {
  display: flex;
  align-items: baseline;
  gap: 8px;
  padding: 4px 0;
}
.item--emphasis-1 { font-weight: 700; }
.item--emphasis-2 { background-color: #e6e6e6; padding: 4px 8px; border-radius: 4px; }
.item--emphasis-3 { background-color: #000; color: #fff; padding: 4px 8px; border-radius: 4px; }
.item .meta { font-size: 11px; opacity: 0.6; }

/* Table */
.table { width: 100%; border-collapse: collapse; }
.table th, .table td { text-align: left; padding: 4px 8px; }
.table th { font-weight: 700; border-bottom: 2px solid #000; }
.table td { border-bottom: 1px solid #e6e6e6; }
.table--small th, .table--small td { font-size: 12px; padding: 2px 6px; }
.table--xsmall th, .table--xsmall td { font-size: 10px; padding: 2px 4px; }
.table--indexed td:first-child { font-weight: 700; width: 30px; }

/* Progress bar */
.progress-bar { width: 100%; height: 8px; background: #e6e6e6; border-radius: 4px; overflow: hidden; }
.progress-bar--large { height: 16px; }
.progress-bar--small { height: 4px; }
.progress-bar--xsmall { height: 2px; }
.progress-bar > div { height: 100%; background: #000; border-radius: 4px; }

/* Progress dots */
.progress-dots { display: flex; gap: 4px; }
.dot { width: 8px; height: 8px; border-radius: 50%; background: #e6e6e6; }
.dot--filled { background: #000; }
.dot--current { background: #000; border: 2px solid #000; }

/* Image */
.image { display: block; max-width: 100%; }
.image--fill { object-fit: fill; width: 100%; height: 100%; }
.image--contain { object-fit: contain; }
.image--cover { object-fit: cover; }

/* Overflow / truncation */
[data-clamp="1"] { overflow: hidden; display: -webkit-box; -webkit-line-clamp: 1; -webkit-box-orient: vertical; }
[data-clamp="2"] { overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
[data-clamp="3"] { overflow: hidden; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; }
.truncate { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.overflow--hidden { overflow: hidden; }
`;
