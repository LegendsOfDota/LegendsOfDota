:: -- Compile the scripts --
::call compile.bat

:: -- Stage source2 binaries --

:: Cleanup the old copy of it
rmdir /S /Q "dota\game"

:: Create directory structure
mkdir "dota"
mkdir "dota\game"
mkdir "dota\content"
mkdir "dota\game\resource"
mkdir "dota\game\scripts\npc"
::mkdir "dota\game\maps"

:: Link the maps
mklink /D /J "dota\game\maps" "maps"
mklink /D /J "dota\content\maps" "src\maps"

mkdir "dota\game\panorama"
mkdir "dota\game\panorama\localization"
::mklink /D /J "dota\game\panorama\localization" "src\localization"

:: Hard link info files
mklink /H "dota\game\addoninfo.txt" "src\addoninfo.txt"

:: Hard link top level scripts
mklink /H "dota\game\scripts\custom_events.txt" "src\scripts\custom_events.txt"
mklink /H "dota\game\scripts\stat_collection.kv" "src\scripts\stat_collection.kv"
mklink /H "dota\game\scripts\custom_net_tables.txt" "src\scripts\custom_net_tables.txt"

:: Hard link the panorama source code
mklink /D /J "dota\content\panorama" "src\panorama"

:: Hard link NPC scripts
mklink /H "dota\game\scripts\npc\activelist.txt" "src\scripts\npc\activelist.txt"
mklink /H "dota\game\scripts\npc\herolist.txt" "src\scripts\npc\herolist.txt"
mklink /H "dota\game\scripts\npc\npc_units_custom.txt" "script_generator\BIN\npc_units_custom.txt"

:: Link script folders
mklink /D /J "dota\game\scripts\vscripts" "src\scripts\vscripts\"
mklink /D /J "dota\game\scripts\kv" "src\scripts\kv"
mklink /D /J "dota\game\scripts\abilities" "src\scripts\abilities"
mklink /D /J "dota\game\scripts\game_sounds" "src\scripts\game_sounds"

:: Link particle folder
mklink /D /J "dota\game\particles" "src\particles"

:: Link resource folders
mklink /D /J "dota\game\resource\flash3" "src\resource\flash3"
mklink /D /J "dota\game\resource\overviews" "src\resource\overviews"

:: Hard link generated scripts
mklink /H "dota\game\resource\addon_english.txt" "script_generator\BIN\addon_english_token.txt"
mklink /H "dota\game\panorama\localization\addon_english.txt" "script_generator\BIN\addon_english.txt"

mklink /H "dota\game\resource\addon_schinese.txt" "script_generator\BIN\addon_schinese_token.txt"
mklink /H "dota\game\panorama\localization\addon_schinese.txt" "script_generator\BIN\addon_schinese.txt"

::mklink /H "dota\game\panorama\localization\addon_english.txt" "script_generator\BIN\addon_english.txt"
::mklink /H "dota\game\panorama\localization\addon_russian.txt" "script_generator\BIN\addon_russian.txt"

mklink /H "dota\game\scripts\npc\npc_abilities_override.txt" "src\scripts\npc\npc_abilities_override.txt"
mklink /H "dota\game\scripts\npc\npc_abilities_custom.txt" "src\scripts\npc\npc_abilities_custom.txt"
mklink /H "dota\game\scripts\npc\npc_heroes_custom.txt" "script_generator\BIN\npc_heroes_custom.txt"

:: Hard link materials folder
mklink /D /J "dota\game\materials" "src\materials"

:: Hard link maps
::mklink /H "dota\game\maps\dota_pvp.vpk" "maps\dota_pvp.vpk"
::mklink /H "dota\game\maps\dota_pvp_tiled.vpk" "maps\dota_pvp_tiled.vpk"

:: Add license agreement
mklink /H "dota\game\LICENSE" "LICENSE"