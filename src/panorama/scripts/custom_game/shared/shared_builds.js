"use strict";

// Hard Coded Recommended Builds
var recommendedBuilds = [
    {
        title: 'Hunter in the night',
        heroName: 'npc_dota_hero_night_stalker',
        attr: 'str',
        build: {
            1: 'magnataur_empower',
            2: 'antimage_blink',
            3: 'lycan_shapeshift',
            4: 'luna_lunar_blessing',
            5: 'night_stalker_hunter_in_the_night',
            6: 'night_stalker_darkness',
        },
        des: 'Get a scepter, and you will rule the night, your vision is amazing and you can see around 1/4 of the map, no one can escape you at night!'
    },
    {
        title: 'Generic Tank',
        heroName: 'npc_dota_hero_centaur',
        attr: 'str',
        build: {
            1: 'huskar_berserkers_blood',
            2: 'dragon_knight_dragon_blood',
            3: 'spectre_dispersion',
            4: 'viper_corrosive_skin',
            5: 'shredder_reactive_armor',
            6: 'alchemist_chemical_rage',
        },
        des: 'These abilities are generally tanky.<br>Centaur, Treant, or Ogre Magi (with str selected) all make good tank heroes.'
    },
    {
        title: 'Infest Support',
        heroName: 'npc_dota_hero_night_stalker',
        attr: 'str',
        build: {
            1: 'pudge_rot',
            2: 'witch_doctor_voodoo_restoration',
            3: 'magnataur_empower',
            4: 'alpha_wolf_command_aura',
            5: 'omniknight_degen_aura',
            6: 'life_stealer_infest',
        },
        des: 'Turn on ROT and HEALING then infest a hero. These spells will not cost mana / hp when you are infested.<br>Get a scepter and the hero you infest will get cleave from empower, and if you play as night stalker, you will get unobscured vision at night!',
    },
    {
        title: 'Global Caster',
        heroName: 'npc_dota_hero_pugna',
        attr: 'int',
        build: {
            1: 'treant_living_armor',
            2: 'holdout_arcane_aura',
            3: 'ancient_apparition_ice_blast',
            4: 'silencer_glaives_of_wisdom',
            5: 'bloodseeker_thirst',
            6: 'zuus_thundergods_wrath',
        },
        des: 'A build that demonstrates a bunch of global casts, good for supporting.'
    },
    {
        title: 'Magic Be Dashed!',
        heroName: 'npc_dota_hero_mirana',
        attr: 'agi',
        build: {
            1: 'medusa_split_shot',
            2: 'sniper_take_aim',
            3: 'spectre_desolate',
            4: 'meepo_geostrike',
            5: 'necronomicon_warrior_mana_burn_lod',
            6: 'phantom_lancer_juxtapose',
        },
    },
    {
        title: 'All your attributes are belong to me',
        heroName: 'npc_dota_hero_windrunner',
        attr: 'int',
        build: {
            1: 'obsidian_destroyer_arcane_orb',
            2: 'obsidian_destroyer_essence_aura_lod',
            3: 'slark_essence_shift',
            4: 'pudge_flesh_heap',
            5: 'silencer_glaives_of_wisdom',
            6: 'windrunner_focusfire',
        },
        des: 'Steal everyone\'s attributes and make them hate you.'
    },
    {
        title: 'Rapture',
        heroName: 'npc_dota_hero_pugna',
        attr: 'int',
        build: {
            1: 'pudge_meat_hook',
            2: 'lone_druid_savage_roar',
            3: 'vengefulspirit_nether_swap',
            4: 'earth_spirit_boulder_smash',
            5: 'magnataur_skewer',
            6: 'bloodseeker_rupture',
        },
        des: 'Cast rapture on someone, and then use all your abilities to make them move, this will cause tons of damage!'
    },
    {
        title: 'Global Stunner',
        heroName: 'npc_dota_hero_pugna',
        attr: 'int',
        build: {
            1: 'sven_storm_bolt',
            2: 'vengefulspirit_magic_missile',
            3: 'antimage_blink',
            4: 'furion_teleportation',
            5: 'holdout_arcane_aura',
            6: 'magnataur_reverse_polarity',
        },
        des: 'Teleport into any fight, stun the enemy hero and carry your team to victory!'
    },
    {
        title: 'Bring the team fight',
        heroName: 'npc_dota_hero_silencer',
        attr: 'int',
        build: {
            1: 'enigma_midnight_pulse',
            2: 'necrolyte_heartstopper_aura',
            3: 'warlock_rain_of_chaos',
            4: 'magnataur_empower',
            5: 'skeleton_king_vampiric_aura',
            6: 'enigma_black_hole',
        },
        des: 'A bunch of abiltiies that generally work well in team fights.'
    },
    {
        title: 'The Duelist',
        heroName: 'npc_dota_hero_juggernaut',
        attr: 'agi',
        build: {
            1: 'phantom_assassin_phantom_strike',
            2: 'slardar_bash',
            3: 'windrunner_focusfire',
            4: 'slark_essence_shift',
            5: 'troll_warlord_fervor',
            6: 'legion_commander_duel',
        },
        des: 'Duel someone, you will win.'
    },
    {
        title: 'The Anti-Tank',
        heroName: 'npc_dota_hero_mirana',
        attr: 'agi',
        build: {
            1: 'antimage_blink',
            2: 'ancient_apparition_ice_blast',
            3: 'life_stealer_feast',
            4: 'slark_essence_shift',
            5: 'troll_warlord_fervor',
            6: 'beastmaster_primal_roar',
        },
        des: 'The enemy is building a tank? These abilities kill tanks.'
    },
    {
        title: 'Glass Cannon',
        heroName: 'npc_dota_hero_sniper',
        attr: 'agi',
        build: {
            1: 'phantom_assassin_coup_de_grace',
            2: 'slardar_bash',
            3: 'drow_ranger_trueshot',
            4: 'slark_essence_shift',
            5: 'alpha_wolf_command_aura',
            6: 'drow_ranger_marksmanship',
        },
        des: 'This hero is a glass cannon. Anyone touches you, you will die, however, you will cause very high damage if you can attack first.'
    },
    {
        title: 'No ulty, can\'t war',
        heroName: 'npc_dota_hero_windrunner',
        attr: 'int',
        build: {
            1: 'antimage_blink',
            2: 'medusa_mana_shield',
            3: 'medusa_split_shot',
            4: 'life_stealer_feast',
            5: 'alchemist_goblins_greed',
            6: 'furion_teleportation',
        },
        des: 'Step 1: Go to the jungle.<br>Step 2: Farm<br>Step 3: ???<br>Step 4: Profit!'
    },
    /*{
        title: 'The Brew Trow',
        heroName: 'npc_dota_hero_brewmaster',
        attr: 'str',
        build: {
            1: 'windrunner_windrun',
            2: 'silencer_curse_of_the_silent',
            3: 'spectre_dispersion',
            4: 'huskar_berserkers_blood',
            5: 'tiny_grow_lod',
            6: 'drow_ranger_marksmanship',
        },
    },
    {
        title: 'Ranged Death',
        heroName: 'npc_dota_hero_windrunner',
        attr: 'agi',
        build: {
            1: 'clinkz_wind_walk',
            2: 'ursa_overpower',
            3: 'medusa_split_shot',
            4: 'life_stealer_feast',
            5: 'phantom_assassin_coup_de_grace',
            6: 'tiny_grow_lod',
        },
    },*/
    {
        title: 'MEDIC!',
        heroName: 'npc_dota_hero_wisp',
        attr: 'str',
        build: {
            1: 'wisp_tether',
            2: 'wisp_overcharge',
            3: 'clinkz_wind_walk',
            4: 'dragon_knight_dragon_blood',
            5: 'holdout_arcane_aura',
            6: 'alchemist_chemical_rage',
        },
        des: 'You are the team\'s medic, heal everyone!'
    },
    {
        title: 'Building Buster',
        heroName: 'npc_dota_hero_treant',
        attr: 'str',
        build: {
            1: 'sven_gods_strength',
            2: 'furion_teleportation',
            3: 'troll_warlord_berserkers_rage',
            4: 'phantom_assassin_blur',
            5: 'lone_druid_spirit_bear_demolish',
            6: 'windrunner_focusfire',
        },
        des: 'A build designed to take down buildings.'
    },
    {
        title: 'Super Rat',
        heroName: 'npc_dota_hero_mirana',
        attr: 'agi',
        build: {
            1: 'furion_teleportation',
            2: 'troll_warlord_fervor',
            3: 'drow_ranger_marksmanship',
            4: 'phantom_assassin_blur',
            5: 'weaver_geminate_attack',
            6: 'chaos_knight_phantasm',
        },
        des: 'An alternate build for taking down buildings.'
    },
    {
        title: 'The Ultimate Rat',
        heroName: 'npc_dota_hero_furion',
        attr: 'int',
        build: {
            1: 'furion_teleportation',
            2: 'furion_force_of_nature',
            3: 'chen_test_of_faith_teleport',
            4: 'lone_druid_true_form',
            5: 'lone_druid_true_form_battle_cry',
            6: 'furion_wrath_of_nature',
        },
        des: 'An alternate build for taking down buildings.'
    },
];

// Export it
Game.shared.recommendedBuilds = recommendedBuilds;
