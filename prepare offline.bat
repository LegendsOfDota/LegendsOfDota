:: -- Compile the scripts --
::call compile.bat

:: -- Stage source2 binaries --

:: Cleanup the old copy of it
rmdir /S /Q "dota_offline"

:: Create directory structure
mkdir "dota_offline"
mkdir "dota_offline\game"
mkdir "dota_offline\content"
mkdir "dota_offline\content\panorama"
mkdir "dota_offline\game\resource"
mkdir "dota_offline\game\scripts\npc"
mkdir "dota_offline\game\maps"

:: Maps
xcopy /y /s "maps" "dota_offline\game\maps\"

mkdir "dota_offline\game\panorama"
mkdir "dota_offline\game\panorama\localization"
::mklink /D /J "dota\game\panorama\localization" "src\localization"

:: Add info
copy "src\addoninfo.txt" "dota_offline\game\addoninfo.txt"

:: Add scripts
xcopy /y /s "src\scripts" "dota\game\scripts\"

::  link the panorama source code
xcopy /y /s "src\panorama" "dota_offline\content\panorama\"

:: Hard link NPC scripts
copy "script_generator\BIN\npc_units_custom.txt" "dota_offline\game\scripts\npc\npc_units_custom.txt"
copy "script_generator\BIN\npc_items_custom.txt "dota_offline\game\scripts\npc\npc_items_custom.txt"

xcopy /y /s "src\particles" "dota_offline\game\particles\"

:: Link resource folders
xcopy /y /s "src\resource\flash3" "dota_offline\game\resource\flash3\"
xcopy /y /s "src\resource\overviews" "dota_offline\game\resource\overviews\"


:: link generated scripts
copy "script_generator\BIN\addon_english_token.txt" "dota_offline\game\resource\addon_english.txt"
copy "script_generator\BIN\addon_english.txt" "dota_offline\game\panorama\localization\addon_english.txt"

copy "script_generator\BIN\addon_schinese_token.txt" "dota_offline\game\resource\addon_schinese.txt"
copy "script_generator\BIN\addon_schinese.txt" "dota_offline\game\panorama\localization\addon_schinese.txt"


copy "script_generator\BIN\npc_heroes_custom.txt" "dota_offline\game\scripts\npc\npc_heroes_custom.txt"


:: link materials folder
xcopy /y /s "src\materials" "dota_offline\game\materials\"

:: Add license agreement
copy "LICENSE" "dota_offline\game\LICENSE"
