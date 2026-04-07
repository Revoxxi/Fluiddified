import type { AchievementDefinition } from '@/types/achievement'

export const CALIBRATION_GUIDE_ACHIEVEMENT_ID = 'torque_of_perfection'

/** Single achievement: ordered Klipper calibration ladder with doc links and command detection. */
export const calibrationGuideAchievement: AchievementDefinition = {
  id: CALIBRATION_GUIDE_ACHIEVEMENT_ID,
  name: 'Torque of Perfection',
  description:
    'Follow the recommended Klipper calibration order—run each step’s commands (in order) from the console.',
  icon: '$cog',
  category: 'klipper',
  rarity: 'common',
  points: 10,
  pinToTop: true,
  unlockMessage: 'Your printer might actually notice the difference.',
  calibrationGuide: {
    steps: [
      {
        title: 'Thermal control (PID or MPC)',
        summary: 'Tune heaters so temperature holds steady before mechanical and motion tuning.',
        docUrl: 'https://www.klipper3d.org/Pid_Calibrate.html',
        triggerCommands: ['PID_CALIBRATE', 'MPC_CALIBRATE'],
        suggestedCommands: {
          direct: [
            'PID_CALIBRATE HEATER=extruder TARGET=200',
            'PID_CALIBRATE HEATER=heater_bed TARGET=60'
          ],
          bowden: [
            'PID_CALIBRATE HEATER=extruder TARGET=200',
            'PID_CALIBRATE HEATER=heater_bed TARGET=60'
          ]
        }
      },
      {
        title: 'Bed tilt (screws helper)',
        summary: 'Level the bed mechanically before mesh—skip if you rely only on a mesh/probe.',
        docUrl: 'https://www.klipper3d.org/Manual_Level.html#the-bed-screws-helper',
        triggerCommands: ['SCREWS_TILT_CALCULATE', 'BED_SCREWS_ADJUST'],
        suggestedCommands: {
          direct: ['SCREWS_TILT_CALCULATE'],
          bowden: ['SCREWS_TILT_CALCULATE']
        }
      },
      {
        title: 'Bed mesh',
        summary: 'Map the bed surface after mechanical leveling.',
        docUrl: 'https://www.klipper3d.org/Bed_Mesh.html',
        triggerCommands: ['BED_MESH_CALIBRATE'],
        suggestedCommands: {
          direct: ['BED_MESH_CALIBRATE'],
          bowden: ['BED_MESH_CALIBRATE']
        }
      },
      {
        title: 'Probe / Z offset',
        summary: 'Set or refine nozzle height relative to the probe or endstop.',
        docUrl: 'https://www.klipper3d.org/Probe_Calibrate.html',
        triggerCommands: ['PROBE_CALIBRATE', 'Z_OFFSET_APPLY_PROBE', 'Z_OFFSET_APPLY_ENDSTOP'],
        suggestedCommands: {
          direct: [
            'PROBE_CALIBRATE',
            'TESTZ Z=-0.1',
            'Z_OFFSET_APPLY_PROBE',
            'SAVE_CONFIG'
          ],
          bowden: [
            'PROBE_CALIBRATE',
            'TESTZ Z=-0.1',
            'Z_OFFSET_APPLY_PROBE',
            'SAVE_CONFIG'
          ]
        }
      },
      {
        title: 'Firmware retraction',
        summary: 'Dial retraction before pressure advance—bowden usually needs more length.',
        docUrl: 'https://www.klipper3d.org/Config_Reference.html#firmware_retraction',
        triggerCommands: ['SET_RETRACTION'],
        suggestedCommands: {
          direct: [
            'SET_RETRACTION RETRACT_LENGTH=0.45 RETRACT_SPEED=40 UNRETRACT_SPEED=20'
          ],
          bowden: [
            'SET_RETRACTION RETRACT_LENGTH=6.5 RETRACT_SPEED=45 UNRETRACT_SPEED=30'
          ]
        }
      },
      {
        title: 'Pressure advance',
        summary:
          'Tune PA using a print test; a tower is usually easier to read than a single line or patch pattern.',
        methodTip:
          'Prefer a pressure-advance tower (or tuned tower macro): line and pattern tests work, but towers often make the best/worst layers easier to read.',
        docUrl: 'https://www.klipper3d.org/Pressure_Advance.html',
        triggerCommands: ['SET_PRESSURE_ADVANCE'],
        suggestedCommands: {
          direct: [
            '; After your tower print, lock in a starting value — adjust from measurements',
            'SET_PRESSURE_ADVANCE VALUE=0.04'
          ],
          bowden: [
            '; Bowden starts higher—still validate with a tower',
            'SET_PRESSURE_ADVANCE VALUE=0.55'
          ]
        }
      },
      {
        title: 'Resonance / input shaper',
        summary: 'Measure or calibrate input shaping last so earlier extrusion tuning stays meaningful.',
        docUrl: 'https://www.klipper3d.org/Resonance_Compensation.html',
        triggerCommands: ['SHAPER_CALIBRATE', 'TEST_RESONANCES'],
        methodTip:
          'Follow the measurement workflow in the docs (toolhead or accelerometer), then apply results before high-speed prints.',
        suggestedCommands: {
          direct: ['SHAPER_CALIBRATE AXIS=X', 'SHAPER_CALIBRATE AXIS=Y'],
          bowden: ['SHAPER_CALIBRATE AXIS=X', 'SHAPER_CALIBRATE AXIS=Y']
        }
      }
    ]
  }
}
