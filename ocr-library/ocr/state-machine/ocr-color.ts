import { ColorType, TetrisBoard } from "src/app/shared/tetris/tetris-board";
import { COLOR_FIRST_COLORS_RGB, COLOR_SECOND_COLORS_RGB, HSVColor, hsvToRgb, RGBColor, rgbToHsv } from "src/app/shared/tetris/tetromino-colors";
import { Frame } from "../util/frame";
import { OCRFrame } from "./ocr-frame";
import { median } from "src/app/shared/scripts/math";

/**
 * Manages the current best guess for what the colors for each level are in a game
 */
export class OCRColor {

    // If known, the derived white mino color
    private knownWhite?: RGBColor;

    // If known, the derived primary color for the level % 10
    private readonly knownPrimary = new Map<number, RGBColor>();

    // If known, the derived secondary color for the level % 10
    private readonly knownSecondary = new Map<number, RGBColor>();

    /**
     * Given a level and color type, return the known corresponding color, defaulting to the default
     * @param level Any numerical level
     * @param colorType white, primary, or secondary
     * @returns The best-guess RGB color for the given level and colorType for the current game
     */
    private getColorForLevel(level: number, colorType: ColorType): RGBColor {
        level = level % 10;

        switch (colorType) {
            case ColorType.EMPTY:
                throw new Error("Cannot predict color for empty color type");
            case ColorType.WHITE:
                return this.knownWhite ?? new RGBColor(250, 250, 250); // realistically slightly off-white
            case ColorType.PRIMARY:
                return this.knownPrimary.get(level) ?? COLOR_FIRST_COLORS_RGB[level];
            case ColorType.SECONDARY:
                return this.knownSecondary.get(level) ?? COLOR_SECOND_COLORS_RGB[level];
        }
    }

    /**
     * Calculates the perceptual difference between two colors in HSV space.
     * Uses corrected hue distance handling.
     */
    private colorDistance(c1: RGBColor, c2: RGBColor): number {
        const hsv1 = rgbToHsv(c1);
        const hsv2 = rgbToHsv(c2);

        // Correct hue distance calculation
        let dh = Math.abs(hsv2.h - hsv1.h);
        dh = Math.min(dh, 360 - dh); // Handle circular hue wraparound

        // Euclidean distance in HSV space
        return Math.sqrt(dh ** 2 + (hsv2.s - hsv1.s) ** 2 + (hsv2.v - hsv1.v) ** 2);
    }

    /**
     * Finds the most similar color from a list of colors to the target color.
     */
    private findClosestColor(targetColor: RGBColor, colors: { type: ColorType; color: RGBColor }[]): ColorType {
        return colors.reduce((closest, current) => 
            this.colorDistance(current.color, targetColor) < this.colorDistance(closest.color, targetColor) 
                ? current 
                : closest
        ).type;
    }

    /**
     * Calculates the median of HSV colors, accounting for hue wraparound
     */
    private medianHSV(colors: HSVColor[]): HSVColor {
        if (colors.length === 0) {
            throw new Error("Cannot compute median of an empty list.");
        }
    
        // Convert hues into Cartesian coordinates for circular median calculation
        const angles = colors.map(c => (c.h * Math.PI) / 180);
        const xComponents = angles.map(a => Math.cos(a));
        const yComponents = angles.map(a => Math.sin(a));
    
        // Compute mean direction (center of mass in unit circle)
        const meanX = median(xComponents);
        const meanY = median(yComponents);
    
        // Convert back to an angle in degrees
        let medianHue = Math.atan2(meanY, meanX) * (180 / Math.PI);
        if (medianHue < 0) medianHue += 360; // Ensure hue is in [0, 360)
    
        // Compute median of saturation and value normally
        const medianS = median(colors.map(c => c.s));
        const medianV = median(colors.map(c => c.v));
    
        return { h: medianHue, s: medianS, v: medianV };
    }

    /**
     * Given a level and raw RGB color, determine the most likely color type.
     * @param level The current level
     * @param colorToClassify The RGB color
     * @returns The most probable ColorType
     */
    public classifyColor(level: number, colorToClassify: RGBColor): ColorType {
        level = level % 10;

        const candidates = [
            { type: ColorType.WHITE, color: this.getColorForLevel(level, ColorType.WHITE) },
            { type: ColorType.PRIMARY, color: this.getColorForLevel(level, ColorType.PRIMARY) },
            { type: ColorType.SECONDARY, color: this.getColorForLevel(level, ColorType.SECONDARY) }
        ];

        return this.findClosestColor(colorToClassify, candidates);
    }

    /**
     * Update known white, primrary, and secondary colors from a source of truth
     * @param frame The current board frame to get raw RGB colors from
     * @param board A stable tetris board with color types that are guaranteed to be correct
     */
    public deriveColorsFromBoard(frame: OCRFrame, board: TetrisBoard, level: number) {
        level = level % 10;

        // The number of minos of the matching color type on the board needed in order to derive the color
        const MIN_MINOS_TO_DERIVE = 5;

        const deriveColorForType = (colorType: ColorType, existingColor: RGBColor | undefined) => {
            // If already derived, no need to re-derive
            if (existingColor) return existingColor;

            // If not enough minos of type, cannot derive
            const minosOfType = [...board.iterateMinos()].filter(({ color }) => color === colorType);
            if (minosOfType.length < MIN_MINOS_TO_DERIVE) return existingColor;

            // Get a list of colors in HSV for that color type
            const hsvColors = minosOfType.map((mino) => rgbToHsv(frame.getRawMinoColor(mino)));

            // Derive the median and convert back to RGB
            const medianHsv = this.medianHSV(hsvColors);
            const medianRgb = hsvToRgb(medianHsv);

            console.log(`Derived for color type ${colorType} at level ${level}: ${medianRgb.toString()}`);
            return medianRgb;
        }

        // Derive white color, if able
        this.knownWhite = deriveColorForType(ColorType.WHITE, this.knownWhite);
        
        // Derive primary color, if able
        const derivedPrimary = deriveColorForType(ColorType.PRIMARY, this.knownPrimary.get(level));
        if (derivedPrimary) this.knownPrimary.set(level, derivedPrimary);

        // Derive secondary color, if able
        const derivedSecondary = deriveColorForType(ColorType.SECONDARY, this.knownSecondary.get(level));
        if (derivedSecondary) this.knownSecondary.set(level, derivedSecondary);
    }

}