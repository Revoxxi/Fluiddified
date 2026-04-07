import type { AchievementDefinition } from '@/types/achievement'

export const achievementDefinitions: AchievementDefinition[] = [
  // ── Category 1: Volume (tiered, 7 tiers each) ──

  {
    id: 'prints_completed',
    name: 'Print Counter',
    description: 'Complete N successful prints',
    icon: '$trophy',
    category: 'volume',
    rarity: 'common',
    points: 10,
    tiers: [1, 10, 50, 100, 250, 500, 1000],
    unit: 'prints'
  },
  {
    id: 'print_hours',
    name: 'Time Invested',
    description: 'Accumulate N hours of print time',
    icon: '$clock',
    category: 'volume',
    rarity: 'common',
    points: 10,
    tiers: [1, 10, 50, 100, 500, 1000, 5000],
    unit: 'hours'
  },
  {
    id: 'filament_used',
    name: 'Spool Slayer',
    description: 'Consume N meters of filament',
    icon: '$fire',
    category: 'volume',
    rarity: 'common',
    points: 10,
    tiers: [1, 10, 100, 500, 1000, 5000, 10000],
    unit: 'meters'
  },
  {
    id: 'print_weight',
    name: 'Heavy Hitter',
    description: 'Print N grams of material',
    icon: '$fire',
    category: 'volume',
    rarity: 'common',
    points: 10,
    tiers: [10, 100, 500, 1000, 5000, 10000, 50000],
    unit: 'grams'
  },

  // ── Category 2: Consistency (various tiers) ──

  {
    id: 'consecutive_success',
    name: 'Streak Master',
    description: 'Complete N prints in a row without failure',
    icon: '$star',
    category: 'consistency',
    rarity: 'uncommon',
    points: 25,
    tiers: [3, 5, 10, 25, 50, 100],
    unit: 'prints'
  },
  {
    id: 'daily_streak',
    name: 'Daily Driver',
    description: 'Print on N consecutive days',
    icon: '$star',
    category: 'consistency',
    rarity: 'uncommon',
    points: 25,
    tiers: [3, 7, 14, 30, 60, 90],
    unit: 'days'
  },
  {
    id: 'weekly_active',
    name: 'Regular',
    description: 'Print at least once per week for N weeks',
    icon: '$clock',
    category: 'consistency',
    rarity: 'uncommon',
    points: 25,
    tiers: [4, 8, 12, 26, 52],
    unit: 'weeks'
  },
  {
    id: 'success_rate',
    name: 'Quality Control',
    description: 'Maintain N% success rate over 50+ prints',
    icon: '$star',
    category: 'consistency',
    rarity: 'rare',
    points: 50,
    tiers: [80, 85, 90, 95, 99],
    unit: '%'
  },
  {
    id: 'days_active',
    name: 'Dedicated Maker',
    description: 'Print on N distinct days total',
    icon: '$clock',
    category: 'consistency',
    rarity: 'uncommon',
    points: 25,
    tiers: [7, 30, 90, 180, 365, 730],
    unit: 'days'
  },
  {
    id: 'uptime_champion',
    name: 'Always On',
    description: 'Printer connected for N cumulative hours',
    icon: '$clock',
    category: 'consistency',
    rarity: 'uncommon',
    points: 25,
    tiers: [100, 500, 1000, 5000, 10000],
    unit: 'hours'
  },

  // ── Category 3: Characteristics (event-based) ──

  {
    id: 'first_print',
    name: 'Hello World',
    description: 'Complete your very first print',
    icon: '$star',
    category: 'characteristics',
    rarity: 'common',
    points: 10,
    unlockMessage: 'Welcome to 3D printing!'
  },
  {
    id: 'first_cancel',
    name: 'Knowing When to Fold',
    description: 'User-cancel a print for the first time (failed/error jobs do not count)',
    icon: '$star',
    category: 'characteristics',
    rarity: 'common',
    points: 10,
    unlockMessage: 'Sometimes discretion is the better part of valor.'
  },
  {
    id: 'speed_demon',
    name: 'Speed Demon',
    description: 'Complete a print in under 5 minutes',
    icon: '$fire',
    category: 'characteristics',
    rarity: 'uncommon',
    points: 25,
    unlockMessage: 'That was fast!'
  },
  {
    id: 'quick_job',
    name: 'Quick Draw',
    description: 'Complete a print in under 1 minute',
    icon: '$fire',
    category: 'characteristics',
    rarity: 'rare',
    points: 50,
    unlockMessage: 'Blink and you miss it!'
  },
  {
    id: 'marathon_4h',
    name: 'Endurance Run',
    description: 'Complete a print over 4 hours',
    icon: '$clock',
    category: 'characteristics',
    rarity: 'uncommon',
    points: 25
  },
  {
    id: 'marathon_12h',
    name: 'Ultra Marathon',
    description: 'Complete a print over 12 hours',
    icon: '$clock',
    category: 'characteristics',
    rarity: 'rare',
    points: 50
  },
  {
    id: 'marathon_24h',
    name: 'Iron Printer',
    description: 'Complete a print over 24 hours',
    icon: '$clock',
    category: 'characteristics',
    rarity: 'epic',
    points: 100,
    unlockMessage: 'A full day of printing!'
  },
  {
    id: 'marathon_48h',
    name: 'Sleep Is Overrated',
    description: 'Complete a print over 48 hours',
    icon: '$clock',
    category: 'characteristics',
    rarity: 'legendary',
    points: 250,
    unlockMessage: 'Two days straight. Incredible.'
  },
  {
    id: 'big_print_50m',
    name: 'Material Consumer',
    description: 'Single print using 50+ meters of filament',
    icon: '$fire',
    category: 'characteristics',
    rarity: 'uncommon',
    points: 25
  },
  {
    id: 'big_print_100m',
    name: 'Mega Build',
    description: 'Single print using 100+ meters of filament',
    icon: '$fire',
    category: 'characteristics',
    rarity: 'rare',
    points: 50
  },
  {
    id: 'big_print_250m',
    name: 'Industrial Scale',
    description: 'Single print using 250+ meters of filament',
    icon: '$fire',
    category: 'characteristics',
    rarity: 'epic',
    points: 100
  },
  {
    id: 'tiny_print',
    name: 'Miniaturist',
    description: 'Complete a print using under 0.5 meters of filament',
    icon: '$star',
    category: 'characteristics',
    rarity: 'uncommon',
    points: 25
  },
  {
    id: 'back_to_back',
    name: 'Assembly Line',
    description: 'Start a new print within 5 minutes of finishing one',
    icon: '$fire',
    category: 'characteristics',
    rarity: 'uncommon',
    points: 25
  },
  {
    id: 'triple_play',
    name: 'Hat Trick',
    description: 'Complete 3 prints in a single day',
    icon: '$star',
    category: 'characteristics',
    rarity: 'uncommon',
    points: 25
  },
  {
    id: 'production_day',
    name: 'Production Mode',
    description: 'Complete 5+ prints in a single day',
    icon: '$star',
    category: 'characteristics',
    rarity: 'rare',
    points: 50
  },
  {
    id: 'factory_floor',
    name: 'Factory Floor',
    description: 'Complete 10+ prints in a single day',
    icon: '$star',
    category: 'characteristics',
    rarity: 'epic',
    points: 100,
    unlockMessage: 'Your printer never rests!'
  },

  // ── Category 4: Timing (event-based) ──

  {
    id: 'night_owl',
    name: 'Night Owl',
    description: 'Start a print between midnight and 4 AM',
    icon: '$clock',
    category: 'timing',
    rarity: 'uncommon',
    points: 25
  },
  {
    id: 'early_bird',
    name: 'Early Bird',
    description: 'Start a print between 5 AM and 7 AM',
    icon: '$clock',
    category: 'timing',
    rarity: 'uncommon',
    points: 25
  },
  {
    id: 'lunch_break',
    name: 'Lunch Break Print',
    description: 'Start a print between 12 PM and 1 PM',
    icon: '$clock',
    category: 'timing',
    rarity: 'common',
    points: 10
  },
  {
    id: 'weekend_warrior',
    name: 'Weekend Warrior',
    description: 'Print on 10 different weekends',
    icon: '$clock',
    category: 'timing',
    rarity: 'rare',
    points: 50,
    tiers: [10],
    unit: 'weekends'
  },
  {
    id: 'midnight_finish',
    name: 'Midnight Delivery',
    description: 'A print completes between 11:55 PM and 12:05 AM',
    icon: '$clock',
    category: 'timing',
    rarity: 'rare',
    points: 50
  },
  {
    id: 'new_years_print',
    name: 'New Year, New Layer',
    description: 'Start or finish a print on January 1st',
    icon: '$star',
    category: 'timing',
    rarity: 'rare',
    points: 50
  },
  {
    id: 'holiday_printer',
    name: 'Holiday Spirit',
    description: 'Print on a major holiday',
    icon: '$star',
    category: 'timing',
    rarity: 'uncommon',
    points: 25
  },
  {
    id: 'friday_13th',
    name: 'Superstitious Maker',
    description: 'Complete a print on Friday the 13th',
    icon: '$star',
    category: 'timing',
    rarity: 'rare',
    points: 50
  },

  // ── Category 5: Klipper Mastery ──

  {
    id: 'first_mesh',
    name: 'Leveled Up',
    description: 'Run your first bed mesh calibration',
    icon: '$cog',
    category: 'klipper',
    rarity: 'common',
    points: 10,
    unlockMessage: 'Your bed is now level!'
  },
  {
    id: 'mesh_master',
    name: 'Mesh Master',
    description: 'Run bed mesh calibration multiple times',
    icon: '$cog',
    category: 'klipper',
    rarity: 'uncommon',
    points: 25,
    tiers: [5, 10, 25],
    unit: 'calibrations'
  },
  {
    id: 'input_shaper',
    name: 'Shake It Off',
    description: 'Run input shaper calibration',
    icon: '$cog',
    category: 'klipper',
    rarity: 'rare',
    points: 50
  },
  {
    id: 'pressure_advance',
    name: 'Under Pressure',
    description: 'Tune pressure advance',
    icon: '$cog',
    category: 'klipper',
    rarity: 'rare',
    points: 50
  },
  {
    id: 'pid_tuned',
    name: 'Dialed In',
    description: 'Complete a PID calibration',
    icon: '$thermometer',
    category: 'klipper',
    rarity: 'uncommon',
    points: 25
  },
  {
    id: 'z_offset_save',
    name: 'Nailed It',
    description: 'Save Z offset',
    icon: '$cog',
    category: 'klipper',
    rarity: 'uncommon',
    points: 25
  },
  {
    id: 'firmware_retract',
    name: 'Retract Master',
    description: 'Configure firmware retraction',
    icon: '$cog',
    category: 'klipper',
    rarity: 'uncommon',
    points: 25
  },
  {
    id: 'multi_extruder',
    name: 'Material Mixer',
    description: 'Use a multi-extruder setup',
    icon: '$cog',
    category: 'klipper',
    rarity: 'rare',
    points: 50
  },
  {
    id: 'exclude_object',
    name: 'Selective Surgeon',
    description: 'Exclude an object during a print',
    icon: '$cog',
    category: 'klipper',
    rarity: 'uncommon',
    points: 25
  },
  {
    id: 'probe_accuracy',
    name: 'Precision Engineer',
    description: 'Run probe accuracy test',
    icon: '$cog',
    category: 'klipper',
    rarity: 'uncommon',
    points: 25
  },
  {
    id: 'speed_test',
    name: 'Speed Racer',
    description: 'Run accelerometer / resonance sampling (e.g. ACCELEROMETER_QUERY)',
    icon: '$fire',
    category: 'klipper',
    rarity: 'rare',
    points: 50
  },
  {
    id: 'endstop_check',
    name: 'Safety First',
    description: 'Query endstops',
    icon: '$cog',
    category: 'klipper',
    rarity: 'common',
    points: 10
  },
  {
    id: 'config_backup',
    name: 'Belt & Suspenders',
    description: 'Save a config backup',
    icon: '$cog',
    category: 'klipper',
    rarity: 'uncommon',
    points: 25
  },
  {
    id: 'macro_creator',
    name: 'Automation Master',
    description: 'Create or edit a macro in config',
    icon: '$console',
    category: 'klipper',
    rarity: 'rare',
    points: 50
  },
  {
    id: 'klipper_restart',
    name: 'Fresh Start',
    description: 'Restart Klipper firmware',
    icon: '$cog',
    category: 'klipper',
    rarity: 'common',
    points: 10,
    tiers: [1, 10, 50, 100],
    unit: 'restarts'
  },
  {
    id: 'save_config',
    name: 'Committed',
    description: 'Use SAVE_CONFIG',
    icon: '$cog',
    category: 'klipper',
    rarity: 'common',
    points: 10,
    tiers: [1, 5, 10, 25],
    unit: 'saves'
  },

  // ── Category 6: Exploration ──

  {
    id: 'first_macro',
    name: 'Script Kiddie',
    description: 'Successfully run your first user-configured G-code macro',
    icon: '$console',
    category: 'exploration',
    rarity: 'common',
    points: 10
  },
  {
    id: 'macro_variety',
    name: 'Macro Maestro',
    description: 'Successfully run N distinct user-configured G-code macros',
    icon: '$console',
    category: 'exploration',
    rarity: 'uncommon',
    points: 25,
    tiers: [5, 10, 25, 50],
    unit: 'macros'
  },
  {
    id: 'camera_viewer',
    name: 'Surveillance Pro',
    description: 'View 3 different camera feeds',
    icon: '$eye',
    category: 'exploration',
    rarity: 'uncommon',
    points: 25
  },
  {
    id: 'theme_changer',
    name: 'Interior Designer',
    description: 'Change the UI theme',
    icon: '$cog',
    category: 'exploration',
    rarity: 'common',
    points: 10
  },
  {
    id: 'theme_collector',
    name: 'Fashion Show',
    description: 'Use 5 different themes',
    icon: '$cog',
    category: 'exploration',
    rarity: 'uncommon',
    points: 25
  },
  {
    id: 'layout_editor',
    name: 'Architect',
    description: 'Customize your dashboard layout',
    icon: '$cog',
    category: 'exploration',
    rarity: 'common',
    points: 10
  },
  {
    id: 'layout_power_user',
    name: 'Grand Architect',
    description: 'Make 10 layout changes',
    icon: '$cog',
    category: 'exploration',
    rarity: 'uncommon',
    points: 25
  },
  {
    id: 'console_explorer',
    name: 'Terminal Wizard',
    description: 'Successfully run N G-code scripts (Klipper accepted the command)',
    icon: '$console',
    category: 'exploration',
    rarity: 'uncommon',
    points: 25,
    tiers: [10, 50, 100, 500],
    unit: 'commands'
  },
  {
    id: 'file_organizer',
    name: 'Tidy Workspace',
    description: 'Create a folder in the file manager',
    icon: '$cog',
    category: 'exploration',
    rarity: 'common',
    points: 10
  },
  {
    id: 'multi_instance',
    name: 'Fleet Commander',
    description: 'Connect with two or more saved printer instances',
    icon: '$cog',
    category: 'exploration',
    rarity: 'rare',
    points: 50
  },
  {
    id: 'community_plugin',
    name: 'Plugin Pioneer',
    description: 'Install a community widget from a plugin ZIP',
    icon: '$cog',
    category: 'exploration',
    rarity: 'rare',
    points: 50,
    unlockMessage: 'Your dashboard just grew a new capability!'
  },
  {
    id: 'keyboard_shortcuts',
    name: 'Shortcut Master',
    description: 'Use 5 different keyboard shortcuts',
    icon: '$cog',
    category: 'exploration',
    rarity: 'uncommon',
    points: 25,
    tiers: [5],
    unit: 'shortcuts'
  },
  {
    id: 'fullscreen_mode',
    name: 'Immersive Mode',
    description: 'Use a fullscreen view',
    icon: '$eye',
    category: 'exploration',
    rarity: 'common',
    points: 10
  },
  {
    id: 'settings_deep_dive',
    name: 'Configurator',
    description: 'Visit every settings section',
    icon: '$cog',
    category: 'exploration',
    rarity: 'rare',
    points: 50
  },
  {
    id: 'gcode_previewer',
    name: 'Blueprint Reader',
    description: 'Load a gcode preview',
    icon: '$eye',
    category: 'exploration',
    rarity: 'common',
    points: 10
  },
  {
    id: 'history_buff',
    name: 'Historian',
    description: 'View the print history page',
    icon: '$clock',
    category: 'exploration',
    rarity: 'common',
    points: 10
  },

  // ── Category 7: Thermal ──

  {
    id: 'temp_precision',
    name: 'Thermal Surgeon',
    description: 'Hold heater within 0.5°C of target for 10 minutes',
    icon: '$thermometer',
    category: 'thermal',
    rarity: 'rare',
    points: 50
  },
  {
    id: 'high_temp',
    name: 'Playing With Fire',
    description: 'Heat a hotend above 280°C',
    icon: '$thermometer',
    category: 'thermal',
    rarity: 'uncommon',
    points: 25
  },
  {
    id: 'abs_warrior',
    name: 'ABS Veteran',
    description: 'Heat bed above 100°C',
    icon: '$thermometer',
    category: 'thermal',
    rarity: 'uncommon',
    points: 25
  },
  {
    id: 'cool_down_patience',
    name: 'Patient Cooler',
    description: 'Wait for bed to cool below 30°C before removing print',
    icon: '$thermometer',
    category: 'thermal',
    rarity: 'uncommon',
    points: 25
  },
  {
    id: 'preheat_master',
    name: 'Warm Welcome',
    description: 'Use 10 temperature presets',
    icon: '$thermometer',
    category: 'thermal',
    rarity: 'uncommon',
    points: 25
  },
  {
    id: 'all_heaters_on',
    name: 'Full Power',
    description: 'Have 3+ heaters at target simultaneously',
    icon: '$thermometer',
    category: 'thermal',
    rarity: 'rare',
    points: 50
  },

  // ── Category 8: Hidden ──

  {
    id: 'konami',
    name: '↑↑↓↓←→←→BA',
    description: 'Enter the Konami code on the dashboard',
    icon: '$help',
    category: 'hidden',
    hidden: true,
    rarity: 'legendary',
    points: 250,
    unlockMessage: 'You know the code!'
  },
  {
    id: 'patience',
    name: 'Zen Master',
    description: 'Watch a print for 30 minutes without interacting',
    icon: '$help',
    category: 'hidden',
    hidden: true,
    rarity: 'rare',
    points: 50
  },
  {
    id: 'emergency_stop',
    name: 'Panic Button',
    description: 'Use emergency stop for the first time',
    icon: '$help',
    category: 'hidden',
    hidden: true,
    rarity: 'common',
    points: 10
  },
  {
    id: 'easter_egg_time',
    name: "It's Printing O'Clock",
    description: 'Check the dashboard at exactly 3:14 PM',
    icon: '$help',
    category: 'hidden',
    hidden: true,
    rarity: 'legendary',
    points: 250
  },
  {
    id: 'palindrome_print',
    name: 'Mirror Mirror',
    description: 'Complete a print with a palindrome duration',
    icon: '$help',
    category: 'hidden',
    hidden: true,
    rarity: 'epic',
    points: 100
  },
  {
    id: 'lucky_seven',
    name: 'Lucky Number',
    description: 'Your 7th print completes in exactly 7 minutes',
    icon: '$help',
    category: 'hidden',
    hidden: true,
    rarity: 'legendary',
    points: 250
  },
  {
    id: 'round_number',
    name: 'Nice and Round',
    description: 'Complete exactly your 100th, 500th, or 1000th print',
    icon: '$help',
    category: 'hidden',
    hidden: true,
    rarity: 'epic',
    points: 100
  },
  {
    id: 'bounced_back',
    name: 'Resilience',
    description: 'Successfully complete a print right after a failure',
    icon: '$help',
    category: 'hidden',
    hidden: true,
    rarity: 'uncommon',
    points: 25
  },
  {
    id: 'browser_refresh',
    name: 'Refresh Addict',
    description: 'Refresh the page 10 times in one session',
    icon: '$help',
    category: 'hidden',
    hidden: true,
    rarity: 'uncommon',
    points: 25
  },
  {
    id: 'night_shift',
    name: 'Graveyard Shift',
    description: 'Have a print running continuously from 11 PM to 6 AM',
    icon: '$help',
    category: 'hidden',
    hidden: true,
    rarity: 'rare',
    points: 50
  },
  {
    id: 'temp_42',
    name: 'The Answer',
    description: 'Set a heater target to exactly 42°C',
    icon: '$help',
    category: 'hidden',
    hidden: true,
    rarity: 'uncommon',
    points: 25,
    unlockMessage: 'The answer to life, the universe, and everything.'
  },
  {
    id: 'scroll_to_bottom',
    name: 'Achievement Hunter',
    description: 'Scroll to the very bottom of the achievements list',
    icon: '$help',
    category: 'hidden',
    hidden: true,
    rarity: 'common',
    points: 10
  },
  {
    id: 'five_hundred_errors',
    name: 'Error Veteran',
    description: 'Accumulate 50 failed or cancelled prints',
    icon: '$help',
    category: 'hidden',
    hidden: true,
    rarity: 'rare',
    points: 50
  }
]
