import { Landmark } from './types';

/**
 * Generates realistic 21 landmarks for a virtual left hand (chord selector).
 * @param fingerCount Number of extended non-thumb fingers (0 to 4)
 */
export function getVirtualLeftHandLandmarks(fingerCount: number): Landmark[] {
  // Center roughly at x=0.25, y=0.58
  const cx = 0.25;
  const cy = 0.58;

  // Wrist
  const wrist: Landmark = [cx, cy + 0.16, 0];

  // Base knuckle positions
  const baseMCPs: Landmark[] = [
    [cx - 0.05, cy + 0.08, 0], // Thumb CMC/MCP
    [cx - 0.035, cy + 0.01, 0], // Index MCP (5)
    [cx - 0.01, cy, 0],         // Middle MCP (9)
    [cx + 0.015, cy + 0.01, 0], // Ring MCP (13)
    [cx + 0.038, cy + 0.03, 0], // Pinky MCP (17)
  ];

  const landmarks: Landmark[] = new Array(21);
  landmarks[0] = wrist;

  // Thumb (always slightly out)
  landmarks[1] = [cx - 0.04, cy + 0.11, 0];
  landmarks[2] = baseMCPs[0];
  landmarks[3] = [cx - 0.07, cy + 0.05, 0];
  landmarks[4] = [cx - 0.09, cy + 0.02, 0];

  // Determine which fingers are extended:
  // 0: none extended (Em)
  // 1: Index extended (C)
  // 2: Index + Middle extended (G)
  // 3: Index + Middle + Ring extended (Am)
  // 4+: All 4 extended (C)
  const isExtended = [
    fingerCount >= 1, // Index
    fingerCount >= 2, // Middle
    fingerCount >= 3, // Ring
    fingerCount >= 4, // Pinky
  ];

  const fingerIndices = [
    [5, 6, 7, 8],
    [9, 10, 11, 12],
    [13, 14, 15, 16],
    [17, 18, 19, 20],
  ];

  for (let f = 0; f < 4; f++) {
    const [mcpIdx, pipIdx, dipIdx, tipIdx] = fingerIndices[f];
    const [bx, by] = baseMCPs[f + 1];
    const extended = isExtended[f];

    landmarks[mcpIdx] = [bx, by, 0];

    if (extended) {
      // Extended upwards (away from wrist)
      landmarks[pipIdx] = [bx, by - 0.05, 0];
      landmarks[dipIdx] = [bx, by - 0.09, 0];
      landmarks[tipIdx] = [bx, by - 0.13, 0];
    } else {
      // Curled inwards toward palm
      landmarks[pipIdx] = [bx, by - 0.02, 0.02];
      landmarks[dipIdx] = [bx, by + 0.015, 0.03];
      landmarks[tipIdx] = [bx, by + 0.04, 0.02];
    }
  }

  return landmarks;
}

/**
 * Generates realistic 21 landmarks for a virtual right hand (strumming wrist).
 * @param wristYFraction Y position of the wrist as fraction of screen height (e.g. 0.5 to 0.75)
 */
export function getVirtualRightHandLandmarks(wristYFraction: number): Landmark[] {
  const cx = 0.75;
  const cy = wristYFraction;

  const wrist: Landmark = [cx, cy, 0];
  const landmarks: Landmark[] = new Array(21);
  landmarks[0] = wrist;

  // Strumming posture: relaxed strum pick pose pointing slightly left and downward
  // Thumb
  landmarks[1] = [cx + 0.03, cy - 0.04, 0];
  landmarks[2] = [cx + 0.04, cy - 0.07, 0];
  landmarks[3] = [cx + 0.03, cy - 0.10, 0];
  landmarks[4] = [cx + 0.01, cy - 0.11, 0];

  // Index (pointing downward/inward like holding a plectrum)
  landmarks[5] = [cx - 0.01, cy - 0.06, 0];
  landmarks[6] = [cx - 0.03, cy - 0.08, 0];
  landmarks[7] = [cx - 0.04, cy - 0.09, 0];
  landmarks[8] = [cx - 0.05, cy - 0.09, 0];

  // Middle
  landmarks[9] = [cx - 0.03, cy - 0.04, 0];
  landmarks[10] = [cx - 0.05, cy - 0.06, 0];
  landmarks[11] = [cx - 0.06, cy - 0.07, 0];
  landmarks[12] = [cx - 0.07, cy - 0.07, 0];

  // Ring
  landmarks[13] = [cx - 0.04, cy - 0.02, 0];
  landmarks[14] = [cx - 0.06, cy - 0.03, 0];
  landmarks[15] = [cx - 0.07, cy - 0.04, 0];
  landmarks[16] = [cx - 0.08, cy - 0.04, 0];

  // Pinky
  landmarks[17] = [cx - 0.05, cy, 0];
  landmarks[18] = [cx - 0.07, cy, 0];
  landmarks[19] = [cx - 0.08, cy, 0];
  landmarks[20] = [cx - 0.09, cy, 0];

  return landmarks;
}
