import { rgbToHsv, hsvToRgb, RGBColor } from "../shared/tetris/tetromino-colors";


test('color-type-changing', () => {

  const q: [RGBColor, { h: number; s: number; v: number }][] =
    [
      [new RGBColor(255, 0, 0), { h: 0, s: 100, v: 100 }],
      [new RGBColor(0, 255, 0), { h: 120, s: 100, v: 100 }],
      [new RGBColor(0, 0, 255), { h: 240, s: 100, v: 100 }],
      [new RGBColor(255, 255, 0), { h: 60, s: 100, v: 100 }],
      [new RGBColor(255, 255, 255), { h: 0, s: 0, v: 100 }],
      [new RGBColor(0, 0, 0), { h: 0, s: 0, v: 0 }],
    ]
  for (const [input, expected] of q) {
    expect(rgbToHsv(input)).toEqual(expected);
  }
  for (const [expected, input] of q) {
    expect(hsvToRgb(input)).toEqual(expected);
  }
});
