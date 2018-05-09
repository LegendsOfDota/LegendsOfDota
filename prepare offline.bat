:: -- Compile the scripts --
::call compile.bat

:: -- Stage source2 binaries --

:: Cleanup the old copy of it
rmdir /y /S /Q "dota_offline"

:: Create directory structure
mkdir "dota_offline"
mkdir "dota_offline"
mkdir "dota_offline\game"
mkdir "dota_offline\content"
mkdir "dota_offline\game\dota_addons"
mkdir "dota_offline\content\dota_addons"
mkdir "dota_offline\game\dota_addons\lod_offline"
mkdir "dota_offline\content\dota_addons\lod_offline"
mkdir "dota_offline\content\dota_addons\lod_offline\panorama"
mkdir "dota_offline\game\dota_addons\lod_offline\resource"
mkdir "dota_offline\game\dota_addons\lod_offline\scripts\npc"
mkdir "dota_offline\game\dota_addons\lod_offline\maps"

:: Maps
xcopy /y /s "maps" "dota_offline\game\dota_addons\lod_offline\maps\"

mkdir "dota_offline\game\dota_addons\lod_offline\panorama"
mkdir "dota_offline\game\dota_addons\lod_offline\panorama\localization"

:: Add info
copy "src\addoninfo.txt" "dota_offline\game\dota_addons\lod_offline\addoninfo.txt"

:: Add scripts
xcopy /y /s "src\scripts" "dota_offline\game\dota_addons\lod_offline\scripts\"

::  link the panorama source code
xcopy /y /s "src\panorama" "dota_offline\content\dota_addons\lod_offline\panorama\"

:: Hard link NPC scripts
copy "script_generator\BIN\npc_units_custom.txt" "dota_offline\game\dota_addons\lod_offline\scripts\npc\npc_units_custom.txt"

xcopy /y /s "src\particles" "dota_offline\game\dota_addons\lod_offline\particles\"

:: Link resource folders
xcopy /y /s "src\resource\flash3" "dota_offline\game\dota_addons\lod_offline\resource\flash3\"
xcopy /y /s "src\resource\overviews" "dota_offline\game\dota_addons\lod_offline\resource\overviews\"


:: link generated scripts
copy "script_generator\BIN\addon_english_token.txt" "dota_offline\game\dota_addons\lod_offline\resource\addon_english.txt"
copy "script_generator\BIN\addon_english.txt" "dota_offline\game\dota_addons\lod_offline\panorama\localization\addon_english.txt"

copy "script_generator\BIN\addon_schinese_token.txt" "dota_offline\game\dota_addons\lod_offline\resource\addon_schinese.txt"
copy "script_generator\BIN\addon_schinese.txt" "dota_offline\game\dota_addons\lod_offline\panorama\localization\addon_schinese.txt"


copy "script_generator\BIN\npc_heroes_custom.txt" "dota_offline\game\dota_addons\lod_offline\scripts\npc\npc_heroes_custom.txt"


:: link materials folder
xcopy /y /s "src\materials" "dota_offline\game\dota_addons\lod_offline\materials\"

:: Add license agreement
copy "LICENSE" "dota_offline\game\dota_addons\lod_offline\LICENSE"
