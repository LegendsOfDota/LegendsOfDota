:: -- Compile the scripts --
::call compile.bat

:: -- Stage source2 binaries --

:: Cleanup the old copy of it

:: Create directory structure
mkdir "alt_dota"
mkdir "alt_dota\game"
mkdir "alt_dota\content"
mkdir "alt_dota\game\resource"
mkdir "alt_dota\game\scripts\npc"
mkdir "alt_dota\game\panorama"

::mkdir "alt_dota\game\maps"

::mklink /D /J "alt_dota\game\maps" "maps"
xcopy /s maps alt_dota\game\maps\ /Y

::mklink /D /J "alt_dota\content\maps" "src\maps"

::mklink /D /J "alt_dota\game\panorama\localization" "src\localization"
xcopy /s src\localization alt_dota\game\panorama\localization\ /Y

::mklink /H "alt_dota\game\addoninfo.txt" "src\addoninfo.txt"
xcopy src\addoninfo.txt alt_dota\game\ /Y

::mklink /H "alt_dota\game\scripts\custom_events.txt" "src\scripts\custom_events.txt"
xcopy src\scripts\custom_events.txt alt_dota\game\scripts\ /Y

::mklink /H "alt_dota\game\scripts\stat_collection.kv" "src\scripts\stat_collection.kv"
xcopy src\scripts\stat_collection.kv alt_dota\game\scripts\ /Y

::mklink /H "alt_dota\game\scripts\custom_net_tables.txt" "src\scripts\custom_net_tables.txt"
xcopy src\scripts\custom_net_tables.txt alt_dota\game\scripts\ /Y

::mklink /D /J "alt_dota\content\panorama" "src\panorama"
xcopy /s src\panorama alt_dota\content\panorama\ /Y

::mklink /H "alt_dota\game\scripts\npc\activelist.txt" "src\scripts\npc\activelist.txt"
xcopy src\scripts\npc\activelist.txt alt_dota\game\scripts\npc\ /Y
::mklink /H "alt_dota\game\scripts\npc\herolist.txt" "src\scripts\npc\herolist.txt"
xcopy src\scripts\npc\herolist.txt alt_dota\game\scripts\npc\ /Y
::mklink /H "alt_dota\game\scripts\npc\npc_units_custom.txt" "script_generator\BIN\npc_units_custom.txt"
xcopy script_generator\BIN\npc_units_custom.txt alt_dota\game\scripts\npc\ /Y
::mklink /H "alt_dota\game\scripts\npc\npc_items_custom.txt" "src\scripts\npc\npc_items_custom.txt"
xcopy src\scripts\npc\npc_items_custom.txt alt_dota\game\scripts\npc\ /Y

::mklink /D /J "alt_dota\game\scripts\vscripts" "src\scripts\vscripts\"
xcopy /s src\scripts\vscripts alt_dota\game\scripts\vscripts\ /Y
::mklink /D /J "alt_dota\game\scripts\kv" "src\scripts\kv"
xcopy /s src\scripts\kv alt_dota\game\scripts\kv\ /Y
::mklink /D /J "alt_dota\game\scripts\abilities" "src\scripts\abilities"
xcopy /s src\scripts\abilities alt_dota\game\scripts\abilities\ /Y
::mklink /D /J "alt_dota\game\scripts\game_sounds" "src\scripts\game_sounds"
xcopy /s src\scripts\game_sounds alt_dota\game\scripts\game_sounds\ /Y



::mklink /D /J "alt_dota\game\scripts\abilities" "src\scripts\abilities"
xcopy /s src\scripts\abilities alt_dota\game\scripts\abilities\ /Y
::mklink /D /J "alt_dota\game\scripts\game_sounds" "src\scripts\game_sounds"
xcopy /s src\scripts\game_sounds alt_dota\game\scripts\game_sounds\ /Y


::mklink /D /J "alt_dota\game\particles" "src\particles"
xcopy /s src\particles alt_dota\game\particles\ /Y


::mklink /D /J "alt_dota\game\resource\flash3" "src\resource\flash3"
xcopy /s src\resource\flash3 alt_dota\game\resource\flash3\ /Y
::mklink /D /J "alt_dota\game\resource\overviews" "src\resource\overviews"
xcopy /s src\resource\overviews alt_dota\game\resource\overviews\ /Y


::mklink /H "alt_dota\game\resource\addon_english.txt" "script_generator\BIN\addon_english.txt"
xcopy script_generator\BIN\addon_english.txt alt_dota\game\resource\ /Y
::mklink /H "alt_dota\game\resource\addon_russian.txt" "script_generator\BIN\addon_russian.txt"
xcopy script_generator\BIN\addon_english.txt alt_dota\game\resource\ /Y

::mklink /H "alt_dota\game\scripts\npc\npc_abilities_override.txt" "src\scripts\npc\npc_abilities_override.txt"
xcopy src\scripts\npc\npc_abilities_override.txt alt_dota\game\scripts\npc\ /Y
::mklink /H "alt_dota\game\scripts\npc\npc_abilities_custom.txt" "src\scripts\npc\npc_abilities_custom.txt"
xcopy src\scripts\npc\npc_abilities_custom.txt alt_dota\game\scripts\npc\ /Y
::mklink /H "alt_dota\game\scripts\npc\npc_heroes_custom.txt" "script_generator\BIN\npc_heroes_custom.txt"
xcopy script_generator\BIN\npc_heroes_custom.txt alt_dota\game\scripts\npc\ /Y

:: Hard link materials folder
::mklink /D /J "alt_dota\game\materials" "src\materials"
xcopy /s src\materials alt_dota\game\materials\ /Y

