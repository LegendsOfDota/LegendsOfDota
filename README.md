Legends of Dota
=====

**Support the innovators not the imitators.**

###About###
 - Pick your skills to build an overpowered masterpiece!
 - Test out different combinations!
 - Create unique and creative heros to dominate your opponent.

###Steam Workshop###
 - Click [here](https://steamcommunity.com/sharedfiles/filedetails/?id=296590332) to view Legends of Dota on the steam workshop.

###Requirements to Compile and Run###
 - Dota 2 Workshop Tools
 - Nodejs

###How to use this?###
 - Compile
 - Stage
 - Run

###Compiling Legends of Dota###
 - Copy `script_generator/settings_example.json` to `script_generator/settings.json` and fill in the `dotaDir` location, this is the path to your `dota 2 beta`, ending in a slash (/) -- Do not use backslashes
 - Run `compile.bat` to perform the compile

###Staging Legends of Dota###
 - Once compiled, you need to stage the project, this can be done by running stage.bat in the root directory of the project.
 - Staging the project creates two directories "dota/content" and "dota/game".
 - Launch the Dota 2 workshop tools and create a new addon (e.g. lod) that you will use to place LoD into. (You should not use any spaces.)
 - The contents of `<lod>/dota/content` needs to be placed into `Steam\steamapps\common\dota 2 beta\content\dota_addons\<addonname>`
 - The contents of `<lod>/dota/game` needs to be placed into `Steam\steamapps\common\dota 2 beta\game\dota_addons\<addonname>`
 - The contents can be simply copied, or a directory junction can be used to mount the folders directly into place. See documention for help, there are directory junctions created in stage.bat
  - Ensure dota 2 is closed while doing any staging, or while modifiying directory junctions
  - Run an admin level command prompt, navigate to the "Legends of Dota" root folder (the one with stage.bat in it):
    - `cd "C:\path\to\cloned\repo\Legends of Dota"`
  - Create two directory junctions, one for content, one for game:
    - Note: You will need to delete the actual mod folders (<modfolder>) if they already exist
    - `mklink /D /J "C:\Program Files (x86)\Steam\steamapps\common\dota 2 beta\game\dota_addons\<modfolder>" "dota\game"`
    - `mklink /D /J "C:\Program Files (x86)\Steam\steamapps\common\dota 2 beta\content\dota_addons\<modfolder>" "dota\content"`
 - If successfully setup, the following file should exist `Steam\steamapps\common\dota 2 beta\game\dota_addons\lod\scripts\npc\npc_heroes_custom.txt`

###Running Legends of Dota###
 - Launch your Legends of Dota addon.
 - Start a map by running `dota_launch_custom_game <my_addon_name> <mapname>`, replacing <my_addon_name> with the name of your addon and <mapname> with a valid map name.
  - Valid map names can be found in the maps folder in the root directory of the repo. Do not include .vpk.
 - Check the console, you should see something along the lines of "Legends of dota is activating!". Any errors while loading will be listed below this.

###Can I contribute code?###
 - Yes, however, your code will be code reviewed.
 - Your code will not be merged unless it meets the quality controls that are in place on this project.
 - Your code will not be merged if it does not follow the coding patterns / layout of the other code in the project.
 - Your code will not be merged if it implements a feature that is not inline with the direction the project is taking -- Please raise an issue asking if a feature would be good before implementing it, you may find certain features will never be approved.

###Can I translate this into my language?###
 - Yes!
 - Open `src/localization/addon_<your langage>.txt`
 - You can reference `addon_english.txt`
 - You might need to save it as unicode, if non standard characters are used

###Translation Credits###
 - [Chinese by ethereal](http://steamcommunity.com/profiles/76561198124343304/)
