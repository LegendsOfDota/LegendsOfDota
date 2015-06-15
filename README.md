Legends of Dota
=====
**Support the innovators not the imitators.**

###About###
 - Pick your skills to build an overpowered masterpiece!
 - Test out different combinations!
 - Create unique and creative heroes to dominate your opponent.
 - For current features, [click here!](https://github.com/ash47/LegendsOfDota#current-features)

###Dota 2 Workshop Version###
 - There is a less stable workshop version available [here](http://steamcommunity.com/sharedfiles/filedetails/?id=296590332) but it has a very active community
 - It is running an older version of dota 2 (old spells, old map, no bounty rune, etc)
 - We recommend using [Lobby Browser](http://getdotastats.com/#d2mods__lobby_guide) to easily find other custom mod gamers.

##Guide for playing Legends of Dota (*Source 1*)##
###Quick Start Guide (Auto-Installer)###
1. [Download the installer](https://github.com/Veroalla/LOD-Auto-Installer/blob/master/LOD%20Auto.zip?raw=true)
2. Extract and run the LOD-Installer.vbs (Windows Only)
3. Restart Dota 2 and skip to [Connecting to Server](https://github.com/ash47/LegendsOfDota#connecting-to-a-source1-server)
- **Note**: Always launch Dota 2 **BEFORE** attempting to connect to a server.

###Manual Installation###
######Repeat 1-3 if your LOD is outdated######
  1. Close dota 2 (Game won't load new LOD files until you restart!)
  2. [Download](https://github.com/ash47/LegendsOfDota/releases) the latest LOD release (lod_s1_bin.zip)
  3. Create a folder called addons in `dota 2 beta/dota/` & extract **ONLY** the `lod` folder inside it.
  4. If there are any other folders inside your `dota 2 beta/dota/addons` folder, please delete them  or move them into another folder (such as `addons_disabled`)

**DO THIS ONCE**
  1. Open `dota 2 beta/dota/gameinfo.txt`
  2. Add `Game       |gameinfo_path|addons/lod` on a new line like this:
```ruby
SearchPaths
                {
                        Game                            |gameinfo_path|.
                        Game                            platform
                        Game                            |gameinfo_path|addons/lod
                }
```
###Connecting to a source1 server###
 - We will use my personal server as an example
 - Launch NORMAL dota 2 (no workshop tools!)
 - Open your console and type the following:
 - `connect lod.ash47.net:27016`
 - Alternatively, simply visit `steam://connect/lod.ash47.net:27016` in your browser
 - If you do not see the standard `Please wait while we waste your time` screen, you have installed Legends of Dota incorrectly, ensure `dota 2 beta/dota/addons/lod/addoninfo.txt` exists. Ensure you did the gameinfo step. Ensure you restarted dota 2.

###List of public source1 servers###
 - Official
  - [Texas, USA] Ash47 1st **lod.ash47.net:27015**
  - [Texas, USA] Ash47 2nd **lod.ash47.net:27016**
  - [Texas, USA] Ash47 3rd **lod.ash47.net:27017**
  - [Texas, USA] Ash47 4th **lod.ash47.net:27018**
 - Unofficial
  - [EU] Veroalla **lod.noip.me:101**
  - [EU] Veroalla **lod.noip.me:102**
  - [EU] Veroalla **lod.noip.me:103** (Without Bots)
  - [Brazil] Pupin's Server **lodpupin.no-ip.org:27016**

###Starting a source1 server###
 - There is debugging help below in the `More SRCDS Setup Help` section, there is also a FAQ below
 - NOTE: Sourcemod stuff is ONLY needed if you want to play with bots, if bots aren't needed, there is no need to intall sourcemod
 - NOTE: Some of the zips/releases below, such as d2fixups and sourcemod have files that need to be copied into other directories, please ensure you fully and correctly install all the files in the release (The releases usually have the folder structure, for example `addons/metamod` which indicates where each file needs to go)
 - Here is the file structure for your own server! Start by making a blank folder somewhere, possibly called `mySexyServer`
  - **server.bat** (You will create this yourself, the contents are specified below)
  - **srcds.exe** ([Download the SRCDS for your OS here](https://forums.alliedmods.net/showthread.php?p=2110203))
  - **bin/** (Simply copy your `Steam/steamapps/common/dota 2 beta/bin` folder in)
  - **dota/** (Simply copy your `Steam/steamapps/common/dota 2 beta/dota` folder in)
  - **dota/addons/lod** (Download the latest release from the [releases section](https://github.com/ash47/LegendsOfDota/releases) above, if you clone or fork the repo, you need to run `stage.bat` which will compile the binaries, and place them into lod_s1_bin, the newer releases also contain the sourcemod plugins)
  - **dota/addons/metamod** ([The latest snapshot in the 1.11 dev branch, or the newest dev branch that exists](https://www.sourcemm.net/snapshots))
  - **dota/addons/d2fixups** ([Download from the first post here](https://forums.alliedmods.net/showthread.php?t=209965))
  - **dota/addons/sourcemod** ([Download the latest snapshot in the 1.8 dev branch, or the newest dev branch that exists](http://www.sourcemod.net/snapshots.php))
  - **dota/addons/sourcemod/plugins/lod_toolkit.smx** (This can be found in sourcemod/plugins folder of the LegendsOfDota repo, you might want to delete / disable all the other plugins that ship with sourcemod, since they aren't needed, this can be done by simply moving them into the `disabled` folder)
  - **dota/maps/dota.bsp** (You need to grab the dota_fixed.bsp in the maps directory from this repo [here](https://github.com/ash47/LegendsOfDota/tree/master/maps), rename it to dota.bsp and replace the existing one. The map is the same, only patched to work with custom games on source1. Note: You only need to do this on servers, NOT clients.)
 - The following goes into a batch file, place this batch file into the same folder as srcds, call it `server.bat`

        @echo off
        cls
        echo Protecting srcds from crashes...
        echo If you want to close srcds and this script, close the srcds window and type Y depending on your language followed by Enter.
        title Legends of Dota watchdog
        :srcds
        echo (%time%) srcds started.
        start /wait srcds.exe -console -game dota +maxplayers 24 +hostport 27016 -condebug -dev +dota_local_addon_enable 1 +dota_local_addon_game lod +dota_force_gamemode 15 +map dota
        echo (%time%) WARNING: srcds closed or crashed, restarting.
        goto srcds


 - Getting metamod to load
  - You will need to do the `dota/gameinfo.txt` step that is mentioned [here](https://wiki.alliedmods.net/Installing_metamod:source)
 - Mounting Legends of Dota
  - You will need to add "Game  |gameinfo_path|addons/lod" without quotes to the end of your `dota/gameinfo.txt` file, the end result is something like this

                    SearchPaths
                    {
                        GameBin             |gameinfo_path|addons/metamod/bin // This tells it to load metamod
                        Game                |gameinfo_path|.
                        Game                platform
                        Game                |gameinfo_path|addons/lod         // This tells it to load the LoD files
                    }
                }
            }


 - If you want to be put onto a team automatically, you will need the follow files created, depending on what you eant your server to do
 - dedicated.kv is required for all dedicated server functions, it will load the bans file and stop noobs from playing
 - An example dedicated.kv file ships with new releases of Legends of Dota, an example of it can be seen below
 - Create `dota 2 beta/dota/cfg/dedicated.kv`

        "dedicated" {
          // Should we fill any left over slots with bots, once the match begins?
          "addBots"   "1"

          // Auto allocation mode
          // 0 = Manual -- players need to jointeam automatically
          // 1 = Auto allocate anyone who joins
          // 2 = Use preAllocate table, auto allocate anyone else who joins
          // 3 = Use preAllocate table for teams, make everyone else a spectator
          // 4 = Use preAllocate table for teams, kick anyone not in there
          "autoAllocate"  "1"

          // Predefined allocations for specific users
          // Use R for radiant, D for dire and S for Spectator (CAPITALS ONLY)
          // Note: if all 5 slots are taken on a team, the player will be put onto the opposite team!
          "preAllocate" {
              //"exampleSteamID64"  "D"
          }

          // Ban players from your server
          "banPlayers" {
              //"exampleSteamID64"    "1"
          }
        }

 - Change the `autoAllocate` setting as per the settings listed above to decide how you want to allocate people onto teams
 - You can have predefined teams, simply use people's steamID64s
 - Auto allocate means that players will be put onto the team with the least players, or radiant if they have the same number of players
 - You can force your team by adding `R`, `D` or `S` to the start of your steam name, for Radiant, Dire and Spectator (preAllocate overrides these prefixes)
 - Once allocated to a team, it can not be changed until the server is restarted
 - Bots can be enabled or disabled using the `addBots` setting in the KV (assuming sourcemod is setup correctly)
 - Players can be banned from your server using the `banPlayers` table, see the example provided

 - You should see the following messages, depending on what you selected:
 - `Loaded LoD dedicated file!`
 - `Bot allocation code was loaded!`
 - `Allocation mode was set to: 1`
 - `Loaded LoD allocation code!`
 - `Auto allocation table loaded!`
 - `Extra bans table loaded!`
 - If you're still having troubles, you can look [here](https://github.com/ash47/Frota#more-srcds-setup-help) for more tips.
 - You may be interested in [Legends of Dota Watch Dog](https://github.com/ash47/LoDWatchDog) -- This is a lightweight app that restarts SRCDS each time it crashes

###Updating your source1 server###
 - When dota 2 receives an update, think twice about updating your server
 - Please verify that d2fixups and metamod actually work with the new version of dota 2, this could take upto several weeks, as they are built on a volunteer basis!
 - Either use steamCMD to update your files, or just reinstall from scratch, chances are you will need a new metamod, sourcemod and d2fixups version
 - It is recommended you keep a copy of your old server until you verify the new server is 100% working
 - It is also recommended you don't update your server unless something drastically new has been added, as there is a good chance things will break

###More SRCDS Setup Help###
 - To debug, try adding **-condebug** to the SRCDS launch parameters, this will log all the server output to server/dota/console.log, you can check for errors in there
 - Verify you have installed metamod and d2fixups correctly, you can do this by adding **+meta list** to your launch parameters, starting the server, then checking your dota/console.log. You should see these two lines:
  - Listing 1 plugin:
  - [01] Dota 2 Fixups (1.9.2) by Nicholas Hastings
 - If you don't see these two, then you have installed either metamod, or d2fixups incorrectly
 - Note: If you installed sourcemod, you might also see sourcemod in that list
 - If you see >> Unknown command "meta" << it means metamod is installed incorrectly, verify you added it to [gameinfo.txt](http://wiki.alliedmods.net/Installing_Metamod:Source#GameInfo)
 - You can verify sourcemod is installed correctly by typing the following into the console
  - sm plugins list
 - If you get >> Unknwon command "sm" << it means sourcemod is not installed correctly
 - You should see the `Legends of Dota Toolkit` plugin listed if all is good
 - You can test `Legends of Dota Toolkit` with the following command
  - sm_gmod
 - Again, it should say the command exists
 - To manually add bots
  - sm_gmode 1
  - dota_bot_populate

###Starting a server - FAQ###
 - **I need help**
  - Do NOT contact me
  - Drop your questions [here](http://steamcommunity.com/workshop/filedetails/discussion/296590332/620703493310739146/)
 - **The server doesn't work**
  - Check the d2fixups topic, there is a small chance that when you have tried to setup the server, everything is broken, because of a recent update, be patent, and don't spam the devs, they will fix things when they have time
 - **Bots don't spawn**
  - There is plenty of help above
 - **My game crashes when I connect**
  - Ensure you installed the patched dota.bsp into your server, it is REQUIRED now

###Server Commands###
 - `lod_sethost` While in the waiting / loading period, this can be used to set the ID of the hoster.
 - `lod_ids` Lists playerIDs matches with steamIDs and player names.
 - `lod_survival` Loads the survival gamemode (It will autostart when the match begins, it will also disable bots).
 - `lod_nobots` Stops bots from spawning (it wont remove bots, if they have already spawned).
 - `lod_cycle` Enable cycling builds.
 - `lod_applybuild(targetID, sourceID)` Makes the person with the targetID get the build from the person with sourceID.
 - `lod_printbuilds` Prints all builds.
 - `lod_editskill(playerID, skillSlot, skillName)` Edits the given skill for the given player
 - `lod_allocate(steamID64, teamID)` Sets the allocation to be used with the given player
 - `lod_show_allocate` Shows all current allocations

###Other Commands###
 - These require sourcemod plugins, and are some what experimental!
 - `sm_gmode(gamemodeID)` Sets the gamemode ID. (this is used to load all pick after the game starts, to allow bots)
 - `clear_playerid(playerID)` Clears a player from the given slot
 - `read_playerid(playerID)` Prints out the 8 bits in the slot for the given playerID (usully SteamID followed by 1)
 - `set_playerid(playerID, steamID32)` Puts the player with the given steamID into the given slot

###Compiling Legends of Dota###
 - This gamemode has a huge chunk generated by scripts
 - This gamemode has files that are relevant to different versions of the mod, and hence, should not be distrubuted with every version
 - You will need node.js installed
 - Copy `script_generator/settings_example.json` to `script_generator/settings.json` and fill in the `dotaDir` location, this is the path to your `dota 2 beta`, ending in a slash (/) -- Do not use backslashes
 - You will need to stage the directories, this creates virtual links to all the files, one for each build we offer, to do this, simply run `stage.bat` (this might need admin permissions)
 - `compile.bat` is used to compile script changes in the script_generator folder, you do not need to restage the changes

###Can I translate this into my language?###
 - Yes!
 - Open `script_generator/CUSTOM/addon_<your langage>.txt`
 - You can reference `addon_english.txt`
 - You might need to save it as unicode, if non standard characters are used
 - Any strings you don't fill in, will be auto copied in from the english file anyways when the gamemode is compiled
 - Note to Ash47: You need to add new languages to the `stage.bat` file!

  ###How do I toggle between skill sets?###
 - This can be done only when the slot count is more than 6
 - The following console commands exist
  - `lod_toggle_set` Which simply toggles between the sets
  - `lod_show_set` Which takes either 0 or 1 as an argument, and will show that set
 - There is also a button located on the GUI to toggle the slots

###Current Features###
 - Picking Interface
 - Basic Option Selection Interfacemet
 - Option to have between 0 and 6 ultimate abilities
 - Option to change starting level
 - Option to enable easy mode
 - Option to hide enemy team's draft from the picking screen (This is hard to implement)
 - Option to select number of skills to ban and allow only host to ban skills
 - Limited Wraith Night Skills
 - Limited Neutral Skills
 - Game Variants
  - All Pick, provides the full hero pool
  - Single Draft, everyone gets a random choice of 10 heroes (You can only use the skills from these heroes)
  - Mirror Draft, both teams get the same hero pool
  - All Random, everyone gets a random hero and random spells
