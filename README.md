Legends of Dota
=====

**Support the innovators not the imitators.**

### About
 - Pick your skills to build an overpowered masterpiece!
 - Test out different combinations!
 - Create unique and creative heros to dominate your opponent.

### Steam Workshop
 - Click [here](https://steamcommunity.com/sharedfiles/filedetails/?id=296590332) to view Legends of Dota on the steam workshop.

### Requirements to Compile and Run
 - Dota 2 Workshop Tools
 - Nodejs

### How to use this?
 - Compile
 - Stage
 - Run

### Compiling Legends of Dota
 - Copy `script_generator/settings_example.json` to `script_generator/settings.json` and fill in the `dotaDir` location, this is the path to your `dota 2 beta`, ending in a slash (/) -- Do not use backslashes
 - Run `compile.bat` to perform the compile

### Staging Legends of Dota
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

### Running Legends of Dota
 - Launch your Legends of Dota addon.
 - Start a map by running `dota_launch_custom_game <my_addon_name> <mapname>`, replacing <my_addon_name> with the name of your addon and <mapname> with a valid map name.
  - Valid map names can be found in the maps folder in the root directory of the repo. Do not include .vpk.
 - Check the console, you should see something along the lines of "Legends of dota is activating!". Any errors while loading will be listed below this.

### Can I contribute code?
 - Yes, however, your code will be code reviewed.
 - Your code will not be merged unless it meets the quality controls that are in place on this project.
 - Your code will not be merged if it does not follow the coding patterns / layout of the other code in the project.
 - Your code will not be merged if it implements a feature that is not inline with the direction the project is taking -- Please raise an issue asking if a feature would be good before implementing it, you may find certain features will never be approved.

### Coding Style Guide
 - All variables and functions should be written in camel case, with the first letter being lowercase, and seperate words starting with uppercase
  - someVariableName is acceptable, some_variable_name and SomeVariableName are not acceptable
  - There are some instances where this rule has generally been broken, this was by mistake, before LoD had a well defined style
 - All code should be thread safe
  - If you make a call to an async function, ensure you check that the resources you want to access are still valid once the callback happens, this is usually needed when timers are used to process something on a unit after a short delay
 - Do not put credits or your name in code, the commit log will have your name, as well as the blame section of GitHub
 - Filenames are strictly lowercase. Sperate words should be seperated by an underscore (\_) to increase readability, short file names should be used where possible, however, file names need to be readible and easily understandable.

### Can I translate this into my language?
 - Yes!
 - Open `src/localization/addon_<your langage>.txt`
 - You can reference `addon_english.txt`
 - You might need to save it as unicode, if non standard characters are used

### Can I upload a modified version of Legends of Dota to the workshop?
 - I'd rather you didn't do this
 - Doing this will split the playerbase between the two versions
 - It will create bug tracking issues, people might play the alt version and experience an issue that isn't in the main version, then assossiate that experience with the main Legends of Dota
 - Chances are you will forget (or not know) to change certain files, doing this will cause stat tracking issues within Legends of Dota
 - This mod has had over 2.5 years worth of work put into it. Taking the mod, making a few changes and then uploading it to the workshop is a complete dick move, especially so if you claim it as your own work
 - By uploading an alternate version of Legends of Dota without my permission, you are saying "I am a dick, and I do not respect you.", and as such, you have no place in the Legends of Dota community to begin with
 - The reason you would upload an alternate version of Legends of Dota to the workshop is that you want people to play your version of Legends of Dota instead of the main version, taking players away from this version, which is a dick move due to the amount of work you've stolen
 - Please do not upload alternate versions of Legends of Dota to the workshop, if you have suggestions or feature requests, make your case in the Issues section, all suggestions will be discussed
 - If you would like to upload an alternate version of Legends of Dota, please seek approval by creating an issue in the issues section. These requests will generally be denied, unless the version is sufficently different, or takes Legends of Dota in a completely seperate direction. Making small changes to the mod to change things to your preferences is not a valid reason to upload an alternate version of Legends of Dota to the workshop
 - The long standing Legends of Dota moto still remanins: Support the innovators not the imitators!

### How do I access the new MixIns feature?
 - The new MixIns feature is a private Legends of Dota feature that is only avaiable on the Steam workshop version of Legends of Dota
 - This feature requires a very special setup in order to compile it
 - The source code for the MixIns feature may be released in the future, however, it will remain private for the time being

### Translation Credits
 - [Chinese by ethereal](http://steamcommunity.com/profiles/76561198124343304/)

### Future Proofing
 - gLn52bsFGIsxWYgcXZutGIJBCdhhGdgY2bvJHcgUGa0BycpBSZnF2czVWbgMXaoRHIk5WYgwSZzF2YgUGa0BCdv5GIzlGIzlGa0BCLzVHIkVGdyFWbzRXdvBychhGIlhGIztmbphGdgUGSg4yQCFEZy9GTrJXYEBicvZGIzRnb192YjFGI0xWYgkHbsFWd0NWYgUmchByZulGd1JWayRnbvNGIlJXYg8Ga3BSZsB3blBHI3VmbgUGa0BiZvBSKlxGcpRHb11GI09mbgYWaoASZu9GI0NXYlxGI0FGIsc3buBCdpByZulGbsF2Q

### Copyright
 - Copyright 2018 Ash47 This item is not authorized for posting on Steam, except under the Steam account named [ash47](http://steamcommunity.com/id/Ash47)
