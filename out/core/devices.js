"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ANDROID_BUTTON_BAR = exports.ANDROID_GESTURE_BAR = exports.ANDROID_STATUS_BAR = exports.FALLBACK_PRESET_ID = exports.CUSTOM_PRESET_ID = exports.BUILTIN_PRESETS = exports.MAX_DIMENSION = exports.MIN_DIMENSION = void 0;
exports.clampDimension = clampDimension;
exports.resolvePresets = resolvePresets;
exports.findPreset = findPreset;
exports.resolveCompareIds = resolveCompareIds;
exports.rotated = rotated;
exports.dprOf = dprOf;
exports.androidViewport = androidViewport;
exports.MIN_DIMENSION = 100;
exports.MAX_DIMENSION = 10000;
/**
 * Device presets. Sizes are CSS pixels. For Android phones they describe the whole
 * screen (system bars included); the website viewport is the screen minus the
 * status bar and navigation area. Values are typical Chrome-reported sizes and
 * are not a guarantee of how a physical device behaves. Pixel 4 and the Redmi
 * sizes come from the original prototype.
 */
exports.BUILTIN_PRESETS = [
    { id: 'pixel-9', name: 'Pixel 9', width: 412, height: 923, group: 'Android', frame: 'android', android: { physicalWidth: 1080, physicalHeight: 2424, dpi: 420, diagonalInches: 6.3, radius: 40 } },
    { id: 'pixel-8', name: 'Pixel 8', width: 412, height: 915, group: 'Android', frame: 'android', android: { physicalWidth: 1080, physicalHeight: 2400, dpi: 420, diagonalInches: 6.2, radius: 36 } },
    { id: 'pixel-7', name: 'Pixel 7', width: 412, height: 915, group: 'Android', frame: 'android', android: { physicalWidth: 1080, physicalHeight: 2400, dpi: 420, diagonalInches: 6.3, radius: 36 } },
    { id: 'pixel-6', name: 'Pixel 6', width: 412, height: 915, group: 'Android', frame: 'android', android: { physicalWidth: 1080, physicalHeight: 2400, dpi: 420, diagonalInches: 6.4, radius: 34 } },
    { id: 'pixel-4', name: 'Pixel 4 (legacy size)', width: 360, height: 720, group: 'Android', frame: 'android' },
    { id: 'redmi-note-5-pro', name: 'Redmi Note 5 Pro', width: 393, height: 786, group: 'Android', frame: 'android' },
    { id: 'redmi-note-4', name: 'Redmi Note 4', width: 411, height: 731, group: 'Android', frame: 'android' },
    { id: 'mobile-375x812', name: 'Mobile 375 × 812', width: 375, height: 812, group: 'Mobile', frame: 'android' },
    { id: 'mobile-390x844', name: 'Mobile 390 × 844', width: 390, height: 844, group: 'Mobile', frame: 'android' },
    { id: 'tablet-768x1024', name: 'Tablet 768 × 1024', width: 768, height: 1024, group: 'Tablet', frame: 'tablet' },
    { id: 'laptop-1366x768', name: 'Laptop 1366 × 768', width: 1366, height: 768, group: 'Laptop', frame: 'laptop' },
    { id: 'desktop-1920x1080', name: 'Desktop 1920 × 1080', width: 1920, height: 1080, group: 'Desktop', frame: 'desktop' }
];
exports.CUSTOM_PRESET_ID = 'custom';
exports.FALLBACK_PRESET_ID = 'pixel-9';
function clampDimension(value, fallback) {
    const n = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(n)) {
        return fallback;
    }
    return Math.min(exports.MAX_DIMENSION, Math.max(exports.MIN_DIMENSION, Math.round(n)));
}
function slug(name) {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'preset';
}
/** Merge built-in presets with user presets from settings. Invalid entries are skipped. */
function resolvePresets(custom) {
    const presets = exports.BUILTIN_PRESETS.map((p) => ({ ...p }));
    if (!Array.isArray(custom)) {
        return presets;
    }
    const seen = new Set(presets.map((p) => p.id));
    for (const raw of custom) {
        if (!raw || typeof raw !== 'object') {
            continue;
        }
        const { name, width, height } = raw;
        if (typeof name !== 'string' || !name.trim() || typeof width !== 'number' || typeof height !== 'number') {
            continue;
        }
        if (width < exports.MIN_DIMENSION || width > exports.MAX_DIMENSION || height < exports.MIN_DIMENSION || height > exports.MAX_DIMENSION) {
            continue;
        }
        let id = `custom-${slug(name)}`;
        for (let i = 2; seen.has(id); i++) {
            id = `custom-${slug(name)}-${i}`;
        }
        seen.add(id);
        presets.push({ id, name: name.trim().slice(0, 40), width: Math.round(width), height: Math.round(height), group: 'Custom', frame: 'none' });
    }
    return presets;
}
function findPreset(presets, id) {
    return presets.find((p) => p.id === id);
}
function resolveCompareIds(ids, presets) {
    const list = Array.isArray(ids) ? ids.filter((x) => typeof x === 'string') : [];
    const valid = list.filter((id, i) => list.indexOf(id) === i && findPreset(presets, id));
    return valid.slice(0, 4);
}
function rotated(width, height) {
    return { width: height, height: width };
}
/** Device pixel ratio implied by the profile density (dpi / 160). */
function dprOf(spec) {
    return spec.dpi / 160;
}
exports.ANDROID_STATUS_BAR = 24;
exports.ANDROID_GESTURE_BAR = 16;
exports.ANDROID_BUTTON_BAR = 48;
/**
 * CSS viewport the website gets inside an Android screen of `width` x `height`:
 * the screen minus the status bar and the navigation area (bottom in portrait or
 * gesture mode, right edge for 3-button navigation in landscape).
 */
function androidViewport(width, height, nav) {
    const landscape = width > height;
    const right = nav === 'buttons' && landscape ? exports.ANDROID_BUTTON_BAR : 0;
    const bottom = nav === 'gesture' ? exports.ANDROID_GESTURE_BAR : landscape ? 0 : exports.ANDROID_BUTTON_BAR;
    return { width: width - right, height: height - exports.ANDROID_STATUS_BAR - bottom };
}
//# sourceMappingURL=devices.js.map