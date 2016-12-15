-- Libraries
local constants = require('constants')
local network = require('network')
local OptionManager = require('optionmanager')
local SkillManager = require('skillmanager')
local Timers = require('easytimers')
local SpellFixes = require('spellfixes')
local util = require('util')
require('statcollection.init')
local Debug = require('lod_debug')              -- Debug library with helper functions, by Ash47
local challenge = require('challenge')
local ingame = require('ingame')

--[[
    Main pregame, selection related handler
]]

local Pregame = class({})

-- Init pregame stuff
function Pregame:init()
    -- Store for options
    self.optionStore = {}

    -- Store for selected heroes and skills
    self.selectedHeroes = {}
    self.selectedPlayerAttr = {}
    self.selectedSkills = {}
    self.selectedRandomBuilds = {}

    -- Mirror draft stuff
    self.useDraftArrays = false
    self.maxDraftHeroes = 30
    self.maxDraftSkills = 0

    -- Some default values
    self.fastBansTotalBans = 3
    self.fastHeroBansTotalBans = 1
    self.fullBansTotalBans = 10
    self.fullHeroBansTotalBans = 2

    -- Stores which playerIDs we have already spawned
    self.spawnedHeroesFor = {}

    -- List of banned abilities
    self.bannedAbilities = {}

    -- List of banned heroes
    self.bannedHeroes = {}

    -- Stores the total bans for each player
    self.usedBans = {}

    -- Who is ready?
    self.isReady = {}
    self.lockedBuilds = {}

    -- Fetch player data
    self:preparePlayerDataFetch()

    -- Set it to the loading phase
    self:setPhase(constants.PHASE_LOADING)

    -- Setup phase stuff
    GameRules:SetCustomGameSetupTimeout(-1)
    GameRules:EnableCustomGameSetupAutoLaunch(false)

    -- Init thinker
    GameRules:GetGameModeEntity():SetThink('onThink', self, 'PregameThink', 0.25)
    GameRules:SetHeroSelectionTime(0)   -- Hero selection is done elsewhere, hero selection should be instant
    GameRules:GetGameModeEntity():SetBotThinkingEnabled(true)

    -- Rune fix
    local totalRunes = 0
    local needBounty = false
    GameRules:GetGameModeEntity():SetRuneSpawnFilter(function(context, runeStuff)
        totalRunes = totalRunes + 1
        if totalRunes < 3 then
            runeStuff.rune_type = DOTA_RUNE_BOUNTY
        else
            if totalRunes % 2 == 1 then
                if math.random() < 0.5 then
                    needBounty = false
                    runeStuff.rune_type = DOTA_RUNE_BOUNTY
                else
                    needBounty = true
                    runeStuff.rune_type = util:pickRandomRune()
                end
            else
                if needBounty then
                    runeStuff.rune_type = DOTA_RUNE_BOUNTY
                else
                    runeStuff.rune_type = util:pickRandomRune()

                end

                -- No longer need a bounty rune
                needBounty = false
            end
        end

        return true
    end, self)

    -- Load troll combos
    self:loadTrollCombos()

    -- Init options
    self:initOptionSelector()

    -- Grab a reference to self
    local this = self

    --[[
        Listen to events
    ]]

    -- Options are locked
    CustomGameEventManager:RegisterListener('lodOptionsLocked', function(eventSourceIndex, args)
        this:onOptionsLocked(eventSourceIndex, args)
    end)

    -- Host looks at a different tab
    CustomGameEventManager:RegisterListener('lodOptionsMenu', function(eventSourceIndex, args)
        this:onOptionsMenuChanged(eventSourceIndex, args)
    end)

    -- Host wants to set an option
    CustomGameEventManager:RegisterListener('lodOptionSet', function(eventSourceIndex, args)
        this:onOptionChanged(eventSourceIndex, args)
    end)

    -- Player wants to set their hero
    CustomGameEventManager:RegisterListener('lodChooseHero', function(eventSourceIndex, args)
        this:onPlayerSelectHero(eventSourceIndex, args)
    end)

    -- Player wants to set their new primary attribute
    CustomGameEventManager:RegisterListener('lodChooseAttr', function(eventSourceIndex, args)
        this:onPlayerSelectAttr(eventSourceIndex, args)
    end)

    -- Player wants to change which ability is in a slot
    CustomGameEventManager:RegisterListener('lodChooseAbility', function(eventSourceIndex, args)
        this:onPlayerSelectAbility(eventSourceIndex, args)
    end)

    -- Player wants a random ability for a slot
    CustomGameEventManager:RegisterListener('lodChooseRandomAbility', function(eventSourceIndex, args)
        this:onPlayerSelectRandomAbility(eventSourceIndex, args)
    end)

    -- Player wants to swap two slots
    CustomGameEventManager:RegisterListener('lodSwapSlots', function(eventSourceIndex, args)
        this:onPlayerSwapSlot(eventSourceIndex, args)
    end)

    -- Player wants to perform a ban
    CustomGameEventManager:RegisterListener('lodBan', function(eventSourceIndex, args)
        this:onPlayerBan(eventSourceIndex, args)
    end)

    -- Player wants to ready up
    CustomGameEventManager:RegisterListener('lodReady', function(eventSourceIndex, args)
        this:onPlayerReady(eventSourceIndex, args)
    end)

    -- Player wants to lock their build in
    CustomGameEventManager:RegisterListener('lodLockBuild', function(eventSourceIndex, args)
        this:onPlayerLockBuild(eventSourceIndex, args)
    end)

    -- Player wants to select their all random build
    CustomGameEventManager:RegisterListener('lodSelectAllRandomBuild', function(eventSourceIndex, args)
        this:onPlayerSelectAllRandomBuild(eventSourceIndex, args)
    end)

    -- Player wants to select a full build
    CustomGameEventManager:RegisterListener('lodSelectBuild', function(eventSourceIndex, args)
        this:onPlayerSelectBuild(eventSourceIndex, args)
    end)

    -- Player wants their hero to be spawned
    CustomGameEventManager:RegisterListener('lodSpawnHero', function(eventSourceIndex, args)
        this:onPlayerAskForHero(eventSourceIndex, args)
    end)

    -- Plays wants to apply a new build
    CustomGameEventManager:RegisterListener('lodSpawnNewBuild', function(eventSourceIndex, args)
        this:onPlayerAskForNewBuild(eventSourceIndex, args)
    end)

    -- Player wants to cast a vote
    CustomGameEventManager:RegisterListener('lodCastVote', function(eventSourceIndex, args)
        this:onPlayerCastVote(eventSourceIndex, args)
    end)

    -- Init debug
    Debug:init()

    -- Fix spawning issues
    self:fixSpawningIssues()

    -- Network heroes
    self:networkHeroes()

    -- Setup default option related stuff
    network:setActiveOptionsTab('presets')
    self:setOption('lodOptionBanning', 1)
    self:setOption('lodOptionSlots', 6)
    self:setOption('lodOptionUlts', 2)
    self:setOption('lodOptionGamemode', 1)
    self:setOption('lodOptionMirrorHeroes', 20)

    -- Map enforcements
    local mapName = GetMapName()

    -- All Pick Only
    if mapName == 'all_pick' then
        self:setOption('lodOptionGamemode', 1)
        self.useOptionVoting = true
    end

    -- Fast All Pick Only
    if mapName == 'all_pick_fast' then
        self:setOption('lodOptionGamemode', 2)
        self.useOptionVoting = true
    end

    -- All pick with 6 slots
    if mapName == 'all_pick_6' then
        self:setOption('lodOptionGamemode', 1)
        self:setOption('lodOptionSlots', 6, true)
        self:setOption('lodOptionCommonMaxUlts', 2, true)
        self.useOptionVoting = true
        self.noSlotVoting = true
    end

    -- All pick with 4 slots
    if mapName == 'all_pick_4' then
        self:setOption('lodOptionGamemode', 1)
        self:setOption('lodOptionSlots', 4, true)
        self:setOption('lodOptionCommonMaxUlts', 1, true)
        self.useOptionVoting = true
        self.noSlotVoting = true
    end

    -- Mirror Draft Only
    if mapName == 'mirror_draft' then
        self:setOption('lodOptionGamemode', 3)
        self.useOptionVoting = true
    end

    -- All random only
    if mapName == 'all_random' then
        self:setOption('lodOptionGamemode', 4)
        self.useOptionVoting = true
    end

    -- Custom -- set preset
    if mapName == 'custom' or mapName == 'custom_bot' or mapName == '10_vs_10' or mapName == 'classic' or mapName == 'allow_voting' then
        self:setOption('lodOptionGamemode', -1)
    end

    -- Challenge Mode
    if mapName == 'challenge' then
        self.challengeMode = true
    end

    -- Default banning
    self:setOption('lodOptionBanning', 3)

    -- Bot match
    if mapName == 'custom_bot' or mapName == '10_vs_10' or mapName == 'allow_voting' or mapName == 'classic' then
        self.enabledBots = true
    end

    -- 10 VS 10
    if mapName == '10_vs_10' then
        GameRules:SetCustomGameTeamMaxPlayers(DOTA_TEAM_GOODGUYS, 10)
        GameRules:SetCustomGameTeamMaxPlayers(DOTA_TEAM_BADGUYS, 10)

        self:setOption('lodOptionBotsRadiant', 10, true)
        self:setOption('lodOptionBotsDire', 10, true)
    end

    -- Exports for stat collection
    local this = self
    function PlayerResource:getPlayerStats(playerID)
        return this:getPlayerStats(playerID)
    end

    -- Spawning stuff
    self.spawnQueue = {}
    self.currentlySpawning = false
    self.cachedPlayerHeroes = {}
end

-- Gets stats for the given player
function Pregame:getPlayerStats(playerID)
    local playerInfo =  {
        steamID32 = PlayerResource:GetSteamAccountID(playerID),                         -- steamID32    The player's steamID
    }

    -- Add selected hero
    playerInfo.h = (self.selectedHeroes[playerID] or ''):gsub('npc_dota_hero_', '')     -- h            The hero they selected

    -- Add selected skills
    local build = self.selectedSkills[playerID] or {}
    for i=1,6 do
        playerInfo['A' .. i] = build[i] or ''                                           -- A[1-6]       Ability 1 - 6
    end

    -- Add selected attribute
    playerInfo.s = self.selectedPlayerAttr[playerID] or ''                              -- s            Selected Attribute (str, agi, int)

    -- Grab there hero and attempt to add info on it
    local hero = PlayerResource:GetSelectedHeroEntity(playerID)

    -- Ensure we have a hero
    if hero ~= nil then
        -- Attempt to find team
        playerInfo.t = hero:GetTeam()                                                   -- t            The team number this player is on

        -- Read key info
        playerInfo.l = hero:GetLevel()                                                  -- l            The level of this hero
        playerInfo.k = hero:GetKills()                                                  -- k            The number of kills this hero has
        playerInfo.a = hero:GetAssists()                                                -- a            The number of assists this player has
        playerInfo.d = hero:GetDeaths()                                                 -- d            The number of deaths this player has
        playerInfo.g = math.floor(PlayerResource:GetGoldPerMin(playerID))               -- g            This player's gold per minute
        playerInfo.x = math.floor(PlayerResource:GetXPPerMin(playerID))                 -- x            This player's EXP per minute
        playerInfo.r = math.floor(PlayerResource:GetGold(playerID))                     -- r            How much gold this player currently has
        for slotID=1,6 do
            local item = hero:GetItemInSlot(slotID - 1)

            if item then
                playerInfo['I' .. slotID] = item:GetAbilityName():gsub('item_', '')     -- I[1-6]       Items 1 - 6
            else
                playerInfo['I' .. slotID] = ''
            end
        end
    else
        -- Default values if hero doesn't exist for some weird reason
        playerInfo.t = 0
        playerInfo.l = 0
        playerInfo.k = 0
        playerInfo.a = 0
        playerInfo.d = 0
        playerInfo.g = 0
        playerInfo.x = 0
        playerInfo.r = 0
        playerInfo['I1'] = ''
        playerInfo['I2'] = ''
        playerInfo['I3'] = ''
        playerInfo['I4'] = ''
        playerInfo['I5'] = ''
        playerInfo['I6'] = ''
    end

    return playerInfo
end

-- Checks for premium players
function Pregame:checkForPremiumPlayers()
    local maxPlayerID = 24

    -- Stores premium info
    local premiumInfo = {}

    for playerID=0,maxPlayerID-1 do
        if PlayerResource:GetConnectionState(playerID) >= 2 then
            premiumInfo[playerID] = util:getPremiumRank(playerID)
        end
    end

    -- Push the premium info
    network:setPremiumInfo(premiumInfo)
end

-- Thinker function to handle logic
function Pregame:onThink()
    -- Grab the phase
    local ourPhase = self:getPhase()

    --[[
        LOADING PHASE
    ]]
    if ourPhase == constants.PHASE_LOADING then
        -- Are we in the custom game setup phase?
        if GameRules:State_Get() >= DOTA_GAMERULES_STATE_CUSTOM_GAME_SETUP then
        	-- Are we using challenge mode?
        	if self.challengeMode then
        		-- Setup challenge mode
        		challenge:setup(self)
        		return 0.1
        	end

            -- Are we using option selection, or option voting?
            if self.useOptionVoting then
                -- Option voting
                self:setPhase(constants.PHASE_OPTION_VOTING)
                self:setEndOfPhase(Time() + OptionManager:GetOption('maxOptionVotingTime'))
            else
                -- Option selection
                self:setPhase(constants.PHASE_OPTION_SELECTION)
                self:setEndOfPhase(Time() + OptionManager:GetOption('maxOptionSelectionTime'))
            end
        end

        -- Wait for time to pass
        return 0.1
    end

    -- Check for premium players
    if not self.checkedPremiumPlayers then
        self.checkedPremiumPlayers = true
        self:checkForPremiumPlayers()
    end

    --[[
        OPTION SELECTION PHASE
    ]]
    if ourPhase == constants.PHASE_OPTION_SELECTION then
        -- Is it over?
        if Time() >= self:getEndOfPhase() and self.freezeTimer == nil then
            -- Finish the option selection
            self:finishOptionSelection()
        end

        return 0.1
    end

    --[[
        OPTION VOTING PHASE
    ]]

    if ourPhase == constants.PHASE_OPTION_VOTING then
        -- Is it over?
        if Time() >= self:getEndOfPhase() and self.freezeTimer == nil then
            -- Finish the option selection
            self:finishOptionSelection()
        end

        return 0.1
    end

    -- Process options ONCE here
    if not self.processedOptions then
        -- Process options
        self:processOptions()
    end

    -- Try to add bot players
    if not self.addedBotPlayers then
    	self:addBotPlayers()
    end

    --[[
        BANNING PHASE
    ]]
    if ourPhase == constants.PHASE_BANNING then
        -- Is it over?
        if Time() >= self:getEndOfPhase() and self.freezeTimer == nil then
            -- Is there hero selection?
            if self.noHeroSelection then
                -- Is there all random selection?
                if self.allRandomSelection then
                    -- Goto all random
                    self:setPhase(constants.PHASE_RANDOM_SELECTION)
                    self:setEndOfPhase(Time() + OptionManager:GetOption('randomSelectionTime'), OptionManager:GetOption('randomSelectionTime'))
                else
                    -- Nope, change to review
                    self:setPhase(constants.PHASE_REVIEW)
                    self:setEndOfPhase(Time() + OptionManager:GetOption('reviewTime'), OptionManager:GetOption('reviewTime'))
                end
            else
                -- Change to picking phase
                self:setPhase(constants.PHASE_SELECTION)
                self:setEndOfPhase(Time() + OptionManager:GetOption('pickingTime'), OptionManager:GetOption('pickingTime'))
            end
        end

        return 0.1
    end

    -- Selection phase
    if ourPhase == constants.PHASE_SELECTION then
        if self.useDraftArrays and not self.draftArrays then
            self:buildDraftArrays()
        end

        -- Pick builds for bots
        if not self.doneBotStuff then
            self.doneBotStuff = true
            self:generateBotBuilds()
        end

        -- Is it over?
        if Time() >= self:getEndOfPhase() and self.freezeTimer == nil then
            -- Change to picking phase
            self:setPhase(constants.PHASE_REVIEW)
            self:setEndOfPhase(Time() + OptionManager:GetOption('reviewTime'), OptionManager:GetOption('reviewTime'))
        end

        return 0.1
    end

    -- All random phase
    if ourPhase == constants.PHASE_RANDOM_SELECTION then
        if not self.allRandomBuilds then
            self:generateAllRandomBuilds()
        end

        -- Pick builds for bots
        if not self.doneBotStuff then
            self.doneBotStuff = true
            self:generateBotBuilds()
        end

        -- Is it over?
        if Time() >= self:getEndOfPhase() and self.freezeTimer == nil then
            -- Change to picking phase
            self:setPhase(constants.PHASE_REVIEW)
            self:setEndOfPhase(Time() + OptionManager:GetOption('reviewTime'), OptionManager:GetOption('reviewTime'))
        end

        return 0.1
    end

    -- Process options ONCE here
    if not self.validatedBuilds then
        self:validateBuilds()
        self:precacheBuilds()
    end

    -- Review
    if ourPhase == constants.PHASE_REVIEW then
        -- Is it over?
        if Time() >= self:getEndOfPhase() and self.freezeTimer == nil then
            -- Change to picking phase
            self:setPhase(constants.PHASE_SPAWN_HEROES)

            -- Kill the selection screen
            GameRules:FinishCustomGameSetup()
        end

        return 0.1
    end

    -- Once we get to this point, we will not fire again

    -- Game is starting, spawn heroes
    if ourPhase == constants.PHASE_SPAWN_HEROES then
        -- Do things after a small delay
        local this = self

        -- Hook bot stuff
        self:hookBotStuff()

        -- Spawn all humans
        Timers:CreateTimer(function()
            -- Spawn all players
        	this:spawnAllHeroes()
        end, DoUniqueString('spawnbots'), 0.1)

        -- Move to item picking
        self:setPhase(constants.PHASE_ITEM_PICKING)

        return 0.1
    end

    -- Is it the stupid item picking phase?
    if ourPhase == constants.PHASE_ITEM_PICKING then
        -- Wait for the game to start
        if GameRules:State_Get() < DOTA_GAMERULES_STATE_PRE_GAME then
            return 0.1
        end

        -- Do things after a small delay
        local this = self

        Timers:CreateTimer(function()
            -- Fix builds
            this:fixBuilds()

            -- Move to ingame
            this:setPhase(constants.PHASE_INGAME)

            -- Start tutorial mode so we can show tips to players
            Tutorial:StartTutorialMode()
        end, DoUniqueString('preventcamping'), 1)

        -- Add extra towers
        Timers:CreateTimer(function()
            this:addExtraTowers()
        end, DoUniqueString('createtowers'), 0.2)

        -- Prevent fountain camping
        Timers:CreateTimer(function()
            this:preventCamping()
        end, DoUniqueString('preventcamping'), 0.3)

        -- Init ingame stuff
        Timers:CreateTimer(function()
            ingame:onStart()
        end, DoUniqueString('preventcamping'), 1)
    end
end

-- Called to prepare to get player data when someone connects
function Pregame:preparePlayerDataFetch()
    -- Listen for someone who is connecting
    --ListenToGameEvent('player_connect_full', function(keys)
    --    util:fetchPlayerData()
    --end, nil)

    -- Attempt to pull after a minor delay
    --Timers:CreateTimer(function()
        --util:fetchPlayerData()
    --end, DoUniqueString('fetchPlayerData'), 0.1)
end

-- Called automatically when we get player data
function Pregame:onGetPlayerData(playerDataBySteamID)
	local maxPlayerID = 24

    self.playerGameStats = {}

    for playerID = 0,maxPlayerID-1 do
        local steamID = PlayerResource:GetSteamAccountID(playerID)
        if steamID ~= 0 then
            local theirData = playerDataBySteamID[tostring(steamID)]
            if theirData then
                self.playerGameStats[playerID] = theirData
            end
        end
    end

    -- Share stats
    network:sharePlayerStats(self.playerGameStats)
end

-- Spawns all heroes (this should only be called once!)
function Pregame:spawnAllHeroes()
    local minPlayerID = 0
    local maxPlayerID = 24

    -- Loop over all playerIDs
    for playerID = minPlayerID,maxPlayerID-1 do
    	-- Attempt to spawn the player
    	self:spawnPlayer(playerID)
    end
end

-- Spawns a given player
function Pregame:spawnPlayer(playerID)
    -- Is there a player in this slot?
    if PlayerResource:GetConnectionState(playerID) >= 1 then
        -- There is, go ahead and build this player

        -- Only spawn a hero for a given player ONCE
        if self.spawnedHeroesFor[playerID] then return end
        self.spawnedHeroesFor[playerID] = true

        -- Insert the player for spawning
        table.insert(self.spawnQueue, playerID)

        -- Actually spawn the player
        self:actualSpawnPlayer()
    end
end

function Pregame:actualSpawnPlayer()
    -- Is there someone to spawn?
    if #self.spawnQueue <= 0 then return end

    -- Only spawn ONE player at a time!
    if self.currentlySpawning then return end
    self.currentlySpawning = true

    -- Grab a reference to self
    local this = self

    -- Give a small delay, and then continue
    Timers:CreateTimer(function()
        -- Done spawning, start the next one
        this.currentlySpawning = false

        -- Continue actually spawning
        this:actualSpawnPlayer()
    end, DoUniqueString('continueSpawning'), 0.1)

    -- Try to spawn this player using safe stuff
    local status, err = pcall(function()
        -- Grab a player to spawn
        local playerID = table.remove(this.spawnQueue, 1)

        -- Don't allow a player to get two heroes
        if PlayerResource:GetSelectedHeroEntity(playerID) ~= nil then
        	return
        end

        -- Grab their build
        local build = self.selectedSkills[playerID]

        -- Validate the player
        local player = PlayerResource:GetPlayer(playerID)
        if player ~= nil then
            local heroName = self.selectedHeroes[playerID] or self:getRandomHero()

            local spawnTheHero = function()
                local status2,err2 = pcall(function()
                    -- Create the hero and validate it
                    local hero = CreateHeroForPlayer(heroName, player)

                    UTIL_Remove(hero)

                    --[[if hero ~= nil and IsValidEntity(hero) then
                        SkillManager:ApplyBuild(hero, build or {})

                        -- Do they have a custom attribute set?
                        if self.selectedPlayerAttr[playerID] ~= nil then
                            -- Set it

                            local toSet = 0

                            if self.selectedPlayerAttr[playerID] == 'str' then
                                toSet = 0
                            elseif self.selectedPlayerAttr[playerID] == 'agi' then
                                toSet = 1
                            elseif self.selectedPlayerAttr[playerID] == 'int' then
                                toSet = 2
                            end

                            -- Set a timer to fix stuff up
                            Timers:CreateTimer(function()
                                if IsValidEntity(hero) then
                                    hero:SetPrimaryAttribute(toSet)
                                end
                            end, DoUniqueString('primaryAttrFix'), 0.1)
                        end
                    end]]
                end)

                -- Did the spawning of this hero fail?
                if not status2 then
                    SendToServerConsole('say "Post this to the LoD comments section: '..err2:gsub('"',"''")..'"')
                end
            end

            if this.cachedPlayerHeroes[playerID] then
                -- Directly spawn the hero
                spawnTheHero()
            else
                -- Attempt to precache their hero
                PrecacheUnitByNameAsync(heroName, function()
                    -- We have now cached this player's hero
                    this.cachedPlayerHeroes[playerID] = true

                    -- Spawn it
                    spawnTheHero()
                end, playerID)
            end
        else
            -- This player has not spawned!
            self.spawnedHeroesFor[playerID] = nil
        end
    end)

    -- Did the spawning of this hero fail?
    if not status then
        SendToServerConsole('say "Post this to the LoD comments section: '..err:gsub('"',"''")..'"')
    end
end

function Pregame:fixBuilds()
    local maxPlayerID = 24
    for playerID=0,maxPlayerID-1 do
        local hero = PlayerResource:GetSelectedHeroEntity(playerID)

        if hero ~= nil and IsValidEntity(hero) then
            -- Grab their build
            local build = self.selectedSkills[playerID]

            if build then
                local status2,err2 = pcall(function()
                    SkillManager:ApplyBuild(hero, build or {})

                    -- Do they have a custom attribute set?
                    if self.selectedPlayerAttr[playerID] ~= nil then
                        -- Set it

                        local toSet = 0

                        if self.selectedPlayerAttr[playerID] == 'str' then
                            toSet = 0
                        elseif self.selectedPlayerAttr[playerID] == 'agi' then
                            toSet = 1
                        elseif self.selectedPlayerAttr[playerID] == 'int' then
                            toSet = 2
                        end

                        -- Set a timer to fix stuff up
                        Timers:CreateTimer(function()
                            if IsValidEntity(hero) then
                                hero:SetPrimaryAttribute(toSet)
                            end
                        end, DoUniqueString('primaryAttrFix'), 0.1)
                    end
                end)
            end
        end
    end
end

-- Returns a random hero [will be unique]
function Pregame:getRandomHero(filter)
    -- Build a list of heroes that have already been taken
    local takenHeroes = {}
    for k,v in pairs(self.selectedHeroes) do
        takenHeroes[v] = true
    end

    local possibleHeroes = {}

    for k,v in pairs(self.allowedHeroes) do
        if not takenHeroes[k] and (filter == nil or filter(k)) then
            table.insert(possibleHeroes, k)
        end
    end

    -- If no heroes were found, just give them pudge
    -- This should never happen, but if it does, WTF mate?
    if #possibleHeroes == 0 then
        return 'npc_dota_hero_pudge'
    end

    return possibleHeroes[math.random(#possibleHeroes)]
end

-- Setup the selectable heroes
function Pregame:networkHeroes()
    local allHeroes = LoadKeyValues('scripts/npc/npc_heroes.txt')
    local allHeroesCustom = LoadKeyValues('scripts/npc/npc_heroes_custom.txt')
    local flags = LoadKeyValues('scripts/kv/flags.kv')
    local oldAbList = LoadKeyValues('scripts/kv/abilities.kv')
    local hashCollisions = LoadKeyValues('scripts/kv/hashes.kv')

    local heroToSkillMap = oldAbList.heroToSkillMap

    -- Prepare flags
    local flagsInverse = {}
    for flagName,abilityList in pairs(flags) do
        for abilityName,nothing in pairs(abilityList) do
            -- Ensure a store exists
            flagsInverse[abilityName] = flagsInverse[abilityName] or {}
            flagsInverse[abilityName][flagName] = true
        end
    end

    -- Load in the category data for abilities
    local oldSkillList = oldAbList.skills

    for tabName, tabList in pairs(oldSkillList) do
        for abilityName,uselessNumber in pairs(tabList) do
            flagsInverse[abilityName] = flagsInverse[abilityName] or {}
            flagsInverse[abilityName].category = tabName

            if SkillManager:isUlt(abilityName) then
                flagsInverse[abilityName].isUlt = true
            end
        end
    end

    -- Push flags to clients
    for abilityName, flagData in pairs(flagsInverse) do
        network:setFlagData(abilityName, flagData)
    end

    -- Network custom groups
    for groupName, data in pairs(oldAbList.customGroups) do
        network:sendCustomGroup(groupName, data)
    end

    self.invisSkills = flags.invis

    -- Store the inverse flags list
    self.flagsInverse = flagsInverse

    -- Maps to convert hashes
    self.hashToSkill = {}
    self.skillToHash = {}

    local totalCollisions = 0

    -- Calculate the hashes
    for abilityName, _ in pairs(flagsInverse) do
    	local parts = util:split(abilityName, '_')

    	local hash = ''

    	for i=1,#parts do
    		local part = parts[i]
    		local letter = part:sub(1, 1)

    		hash = hash .. letter
    	end

    	-- Do we need to fix a collision?
    	if hashCollisions[abilityName] then
    		hash = hash .. hashCollisions[abilityName]
    	end

    	if self.hashToSkill[hash] then
    		print(hash .. ' hash collision - ' .. abilityName)
    		totalCollisions = totalCollisions + 1
    	else
    		self.hashToSkill[hash] = abilityName
    		self.skillToHash[abilityName] = hash
    	end
    end

    if totalCollisions > 0 then
    	print('Found ' .. totalCollisions .. ' hash collisions!')
    end

    -- Stores which abilities belong to which heroes
    self.abilityHeroOwner = {}

    local allowedHeroes = {}
    self.heroPrimaryAttr = {}
    self.heroRole = {}

    self.botHeroes = {}

    -- Contains base stats
    local baseHero = allHeroes.npc_dota_hero_base

    for heroName,heroValues in pairs(allHeroes) do
        -- Ensure it is enabled
        if heroName ~= 'Version' and heroName ~= 'npc_dota_hero_base' and heroValues.Enabled == 1 then
            -- Store if we can select it as a bot
            if heroValues.BotImplemented == 1 then
                self.botHeroes[heroName] = {}

                for i=1,16 do
                    local abName = heroValues['Ability' .. i]
                    if abName ~= 'attribute_bonus' then
                        table.insert(self.botHeroes[heroName], abName)
                    end
                end
            end

            -- Grab custom hero data
            local customHero = allHeroesCustom[heroName] or {}

            -- Store all the useful information
            local theData = {
                AttributePrimary = customHero.AttributePrimary or heroValues.AttributePrimary or baseHero.AttributePrimary,
                Role = customHero.Role or heroValues.Role or baseHero.Role,
                Rolelevels = customHero.Rolelevels or heroValues.Rolelevels or baseHero.Rolelevels,
                AttackCapabilities = customHero.AttackCapabilities or heroValues.AttackCapabilities or baseHero.AttackCapabilities,
                AttackDamageMin = customHero.AttackDamageMin or heroValues.AttackDamageMin or baseHero.AttackDamageMin,
                AttackDamageMax = customHero.AttackDamageMax or heroValues.AttackDamageMax or baseHero.AttackDamageMax,
                AttackRate = customHero.AttackRate or heroValues.AttackRate or baseHero.AttackRate,
                AttackRange = customHero.AttackRange or heroValues.AttackRange or baseHero.AttackRange,
                AttackAnimationPoint = customHero.AttackAnimationPoint or heroValues.AttackAnimationPoint or baseHero.AttackAnimationPoint,
                MovementSpeed = customHero.MovementSpeed or heroValues.MovementSpeed or baseHero.MovementSpeed,
                AttributeBaseStrength = customHero.AttributeBaseStrength or heroValues.AttributeBaseStrength or baseHero.AttributeBaseStrength,
                AttributeStrengthGain = customHero.AttributeStrengthGain or heroValues.AttributeStrengthGain or baseHero.AttributeStrengthGain,
                AttributeBaseIntelligence = customHero.AttributeBaseIntelligence or heroValues.AttributeBaseIntelligence or baseHero.AttributeBaseIntelligence,
                AttributeIntelligenceGain = customHero.AttributeIntelligenceGain or heroValues.AttributeIntelligenceGain or baseHero.AttributeIntelligenceGain,
                AttributeBaseAgility = customHero.AttributeBaseAgility or heroValues.AttributeBaseAgility or baseHero.AttributeBaseAgility,
                AttributeAgilityGain = customHero.AttributeAgilityGain or heroValues.AttributeAgilityGain or baseHero.AttributeAgilityGain,
                ArmorPhysical = customHero.ArmorPhysical or heroValues.ArmorPhysical or baseHero.ArmorPhysical,
                MagicalResistance = customHero.MagicalResistance or heroValues.MagicalResistance or baseHero.MagicalResistance,
                ProjectileSpeed = customHero.ProjectileSpeed or heroValues.ProjectileSpeed or baseHero.ProjectileSpeed,
                RingRadius = customHero.RingRadius or heroValues.RingRadius or baseHero.RingRadius,
                MovementTurnRate = customHero.MovementTurnRate or heroValues.MovementTurnRate or baseHero.MovementTurnRate,
                StatusHealth = customHero.StatusHealth or heroValues.StatusHealth or baseHero.StatusHealth,
                StatusHealthRegen = customHero.StatusHealthRegen or heroValues.StatusHealthRegen or baseHero.StatusHealthRegen,
                StatusMana = customHero.StatusMana or heroValues.StatusMana or baseHero.StatusMana,
                StatusManaRegen = customHero.StatusManaRegen or heroValues.StatusManaRegen or baseHero.StatusManaRegen,
                VisionDaytimeRange = customHero.VisionDaytimeRange or heroValues.VisionDaytimeRange or baseHero.VisionDaytimeRange,
                VisionNighttimeRange = customHero.VisionNighttimeRange or heroValues.VisionNighttimeRange or baseHero.VisionNighttimeRange
            }

            local attr = heroValues.AttributePrimary
            if attr == 'DOTA_ATTRIBUTE_INTELLECT' then
                self.heroPrimaryAttr[heroName] = 'int'
            elseif attr == 'DOTA_ATTRIBUTE_AGILITY' then
                self.heroPrimaryAttr[heroName] = 'agi'
            else
                self.heroPrimaryAttr[heroName] = 'str'
            end

            local role = heroValues.AttackCapabilities
            if role == 'DOTA_UNIT_CAP_RANGED_ATTACK' then
                self.heroRole[heroName] = 'ranged'
            else
                self.heroRole[heroName] = 'melee'
            end



            if heroToSkillMap[heroName] then
                for k,v in pairs(heroToSkillMap[heroName]) do
                    theData[k] = v
                end
            else
                local sn = 1
                for i=1,16 do
                    local abName = heroValues['Ability' .. i]

                    if abName ~= 'attribute_bonus' then
                        theData['Ability' .. sn] = abName
                        sn = sn + 1
                    end
                end
            end

            network:setHeroData(heroName, theData)

            -- Store allowed heroes
            allowedHeroes[heroName] = true

            -- Store the owners
            for i=1,16 do
                if theData['Ability'..i] ~= nil then
                    self.abilityHeroOwner[theData['Ability'..i]] = heroName
                end
            end

        end
    end

    -- Store it locally
    self.allowedHeroes = allowedHeroes
end

-- Finishes option selection
function Pregame:finishOptionSelection()
    -- Ensure we are in the options locking phase
    if self:getPhase() ~= constants.PHASE_OPTION_SELECTION and self:getPhase() ~= constants.PHASE_OPTION_VOTING then return end

    -- Validate teams
    local totalRadiant = 0
    local totalDire = 0

    local maxPlayerID = 24

    for playerID=0,maxPlayerID-1 do
        local team = PlayerResource:GetCustomTeamAssignment(playerID)

        if team == DOTA_TEAM_GOODGUYS then
            totalRadiant = totalRadiant + 1
        elseif team == DOTA_TEAM_BADGUYS then
            totalDire = totalDire + 1
        end
    end

    for playerID=0,maxPlayerID-1 do
        local team = PlayerResource:GetCustomTeamAssignment(playerID)

        if team ~= DOTA_TEAM_GOODGUYS and team ~= DOTA_TEAM_BADGUYS then
            if totalDire < totalRadiant then
                totalDire = totalDire + 1
                PlayerResource:SetCustomTeamAssignment(playerID, DOTA_TEAM_BADGUYS)
            else
                totalRadiant = totalRadiant + 1
                PlayerResource:SetCustomTeamAssignment(playerID, DOTA_TEAM_GOODGUYS)
            end

        end
    end

    -- Lock teams
    GameRules:LockCustomGameSetupTeamAssignment(true)

     -- Process gamemodes
    if self.optionStore['lodOptionCommonGamemode'] == 4 then
        self.noHeroSelection = true
        self.allRandomSelection = true
    end

    if self.optionStore['lodOptionCommonGamemode'] == 3 then
        self.useDraftArrays = true
        self.singleDraft = false
    end

    -- Single Draft
    if self.optionStore['lodOptionCommonGamemode'] == 5 then
        self.useDraftArrays = true
        self.singleDraft = true
    end

    -- Move onto the next phase
    if self.optionStore['lodOptionBanningMaxBans'] > 0 or self.optionStore['lodOptionBanningMaxHeroBans'] > 0 or self.optionStore['lodOptionBanningHostBanning'] == 1 then
        -- There is banning
        self:setPhase(constants.PHASE_BANNING)
        self:setEndOfPhase(Time() + OptionManager:GetOption('banningTime'), OptionManager:GetOption('banningTime'))

    else
        -- There is not banning

        -- Is there hero selection?
        if self.noHeroSelection then
            -- No hero selection

            -- Is there all random selection?
            if self.allRandomSelection then
                -- Goto all random
                self:setPhase(constants.PHASE_RANDOM_SELECTION)
                self:setEndOfPhase(Time() + OptionManager:GetOption('randomSelectionTime'), OptionManager:GetOption('randomSelectionTime'))
            else
                -- Goto review
                self:setPhase(constants.PHASE_REVIEW)
                self:setEndOfPhase(Time() + OptionManager:GetOption('reviewTime'), OptionManager:GetOption('reviewTime'))
            end
        else
            -- Hero selection
            self:setPhase(constants.PHASE_SELECTION)
            self:setEndOfPhase(Time() + OptionManager:GetOption('pickingTime'), OptionManager:GetOption('pickingTime'))
        end
    end
end

-- Options Locked event was fired
function Pregame:onOptionsLocked(eventSourceIndex, args)
    -- Ensure we are in the options locking phase
    if self:getPhase() ~= constants.PHASE_OPTION_SELECTION then return end

    -- Grab data
    local playerID = args.PlayerID
    local player = PlayerResource:GetPlayer(playerID)

    -- Ensure they have hosting privileges
    if GameRules:PlayerHasCustomGameHostPrivileges(player) then
        -- Finish the option selection
        self:finishOptionSelection()
    end
end

-- Options menu changed
function Pregame:onOptionsMenuChanged(eventSourceIndex, args)
    -- Ensure we are in the options locking phase
    if self:getPhase() ~= constants.PHASE_OPTION_SELECTION then return end

    -- Grab data
    local playerID = args.PlayerID
    local player = PlayerResource:GetPlayer(playerID)

    -- Ensure they have hosting privileges
    if GameRules:PlayerHasCustomGameHostPrivileges(player) then
        -- Grab and set which tab is active
        local newActiveTab = args.v
        network:setActiveOptionsTab(newActiveTab)
    end
end

-- An option was changed
function Pregame:onOptionChanged(eventSourceIndex, args)
    -- Ensure we are in the options locking phase
    if self:getPhase() ~= constants.PHASE_OPTION_SELECTION then return end

    -- Grab data
    local playerID = args.PlayerID
    local player = PlayerResource:GetPlayer(playerID)

    -- Ensure they have hosting privileges
    if GameRules:PlayerHasCustomGameHostPrivileges(player) then
        -- Grab options
        local optionName = args.k
        local optionValue = args.v

        -- Option values and names are validated at a later stage
        self:setOption(optionName, optionValue)
    end
end

-- Player wants to cast a vote
function Pregame:onPlayerCastVote(eventSourceIndex, args)
    -- Ensure we are in the options voting
    if self:getPhase() ~= constants.PHASE_OPTION_VOTING then return end

    -- Grab the data
    local playerID = args.PlayerID
    local optionName = args.optionName
    local optionValue = args.optionValue
    local player = PlayerResource:GetPlayer(playerID)

    -- Ensure we have a store for vote data
    self.voteData = self.voteData or {}

    -- Option validator
    local optionValidator = {
        slots = function(slotCount)
            return slotCount == 4 or slotCount == 5 or slotCount == 6
        end,

        banning = function(choice)
            return choice == 1 or choice == 0
        end,

        voteModeFifty = function(choice)
            return choice == 1 or choice == 0
        end,

        voteSpeed = function(choice)
            return choice == 1 or choice == 0
        end,
    }

    -- Validate options
    if not optionValidator[optionName] or not optionValidator[optionName](optionValue) then return end

    -- Ensure we have a store for this option
    self.voteData[optionName] = self.voteData[optionName] or {}

    -- Store their vote
    self.voteData[optionName][playerID] = optionValue

    -- Process / update the vote data
    self:processVoteData()
end

-- Processes Vote Data
function Pregame:processVoteData()
    -- Will store results
    local results = {}
    local counts = {}

    for optionName,data in pairs(self.voteData or {}) do
        counts[optionName] = {}

        for playerID,choice in pairs(data) do
            counts[optionName][choice] = (counts[optionName][choice] or 0) + util:getVotingPower(playerID)
        end

        local maxNumber = 0
        for choice,count in pairs(counts[optionName]) do
            if count > maxNumber then
                maxNumber = count
                results[optionName] = choice
            end
        end
    end

    -- Do we have a choice for slots
    if not self.noSlotVoting and results.slots ~= nil then
        if results.slots == 4 then
            self:setOption('lodOptionCommonMaxSlots', 4, true)
            self:setOption('lodOptionCommonMaxUlts', 1, true)
        elseif results.slots == 5 then
            self:setOption('lodOptionCommonMaxSlots', 5, true)
            self:setOption('lodOptionCommonMaxUlts', 1, true)
        elseif results.slots == 6 then
            self:setOption('lodOptionCommonMaxSlots', 6, true)
            self:setOption('lodOptionCommonMaxUlts', 2, true)
        end
    end

    -- Do we have a choice for banning phase?
    if results.banning ~= nil then
        if results.banning == 1 then
        	-- Option Voting
            self:setOption('lodOptionBanning', 3, true)
            self.optionVotingBanning = 1
        else
        	-- No option voting
            self:setOption('lodOptionBanning', 1, true)
            self.optionVotingBanning = 0
        end
    end

    if results.voteModeFifty then
        if results.voteModeFifty == 1 then
            self:setOption('lodOptionGameSpeedVoting', 0, true)
        else
            self:setOption('lodOptionGameSpeedVoting', 0, true)
        end
    end

    if results.voteSpeed then
        if results.voteSpeed == 1 then
            -- Lower repsawn time
            self:setOption('lodOptionGameSpeedRespawnTimePercentage', 50, true)
            self:setOption('lodOptionGameSpeedRespawnTimeConstant', 1, true)

            -- Free gold
            self:setOption('lodOptionGameSpeedStartingGold', 1000, true)
        else
            -- Normal Respawn Time
            self:setOption('lodOptionGameSpeedRespawnTimePercentage', 100, true)
            self:setOption('lodOptionGameSpeedRespawnTimeConstant', 0, true)

            -- No free gold
            self:setOption('lodOptionGameSpeedStartingGold', 0, true)
        end
    end

    -- Push the counts
    network:voteCounts(counts)
end

-- Load up the troll combo bans list
function Pregame:loadTrollCombos()
    -- Load in the ban list
    local tempBanList = LoadKeyValues('scripts/kv/bans.kv')

    -- Store no multicast
    SpellFixes:SetNoCasting(tempBanList.noMulticast, tempBanList.noWitchcraft)

    --local noTower = tempBanList.noTower
    --local noTowerAlways = tempBanList.noTowerAlways
    --local noBear = tempBanList.noBear

    -- Create the stores
    self.banList = {}
    self.wtfAutoBan = tempBanList.wtfAutoBan
    self.OPSkillsList = tempBanList.OPSkillsList
    self.noHero = tempBanList.noHero
    self.lodBanList = tempBanList.lodBanList
    self.doNotRandom = tempBanList.doNotRandom

    -- All OP skills should be added to the LoD ban list
    for skillName,_ in pairs(self.OPSkillsList) do
        self.lodBanList[skillName] = 1
    end

    -- Bans a skill combo
    local function banCombo(a, b)
        -- Ensure ban lists exist
        self.banList[a] = self.banList[a] or {}
        self.banList[b] = self.banList[b] or {}

        -- Store the ban
        self.banList[a][b] = true
        self.banList[b][a] = true
    end

    -- Loop over the banned combinations
    for skillName, group in pairs(tempBanList.BannedCombinations) do
        for skillName2,_ in pairs(group) do
            banCombo(skillName, skillName2)
        end
    end

    -- Function to do a category ban
    local doCatBan
    doCatBan = function(skillName, cat)
        for skillName2,sort in pairs(tempBanList.Categories[cat] or {}) do
            if sort == 1 then
                banCombo(skillName, skillName2)
            elseif sort == 2 then
                doCatBan(skillName, skillName2)
            else
                print('Unknown category banning sort: '..sort)
            end
        end
    end


    -- Loop over category bans
    for skillName,cat in pairs(tempBanList.CategoryBans) do
        doCatBan(skillName, cat)
    end

    -- Ban the group bans
    for _,group in pairs(tempBanList.BannedGroups) do
        for skillName,__ in pairs(group) do
            for skillName2,___ in pairs(group) do
                banCombo(skillName, skillName2)
            end
        end
    end

    -- Ban everything in the always ban list
    for skillName,_ in pairs(tempBanList.alwaysBan) do
        self:banAbility(skillName)
    end
end

-- Tests a build to decide if it is a troll combo
function Pregame:isTrollCombo(build)
    local maxSlots = self.optionStore['lodOptionCommonMaxSlots']

    for i=1,maxSlots do
        local ab1 = build[i]
        if ab1 ~= nil and self.banList[ab1] then
            for j=(i+1),maxSlots do
                local ab2 = build[j]

                if ab2 ~= nil and self.banList[ab1][ab2] then
                    -- Ability should be banned

                    return true, ab1, ab2
                end
            end
        end
    end

    return false
end

-- init option validator
function Pregame:initOptionSelector()
    -- Option validator can only init once
    if self.doneInitOptions then return end
    self.doneInitOptions = true

    self.validOptions = {
        -- Fast gamemode selection
        lodOptionGamemode = function(value)
            -- Ensure it is a number
            if type(value) ~= 'number' then return false end

            -- Map enforcements
            local mapName = GetMapName()

            -- All Pick Only
            if mapName == 'all_pick' then
                return value == 1
            end

            -- Fast All Pick Only
            if mapName == 'all_pick_fast' then
                return value == 2
            end

            -- All Pick 4 slots
            if mapName == 'all_pick_4' then
                return value == 1
            end

            -- All Pick 6 slots
            if mapName == 'all_pick_6' then
                return value == 1
            end

            -- Mirror Draft Only
            if mapName == 'mirror_draft' then
                return value == 3
            end

            -- All random only
            if mapName == 'all_random' then
                return value == 4
            end

            -- Not in a forced map, allow any preset gamemode

            local validGamemodes = {
                [-1] = true,
                [1] = true,
                [2] = true,
                [3] = true,
                [4] = true
            }

            -- Ensure it is one of the above gamemodes
            if not validGamemodes[value] then return false end

            -- It must be valid
            return true
        end,

        -- Fast banning selection
        lodOptionBanning = function(value)
            return value == 1 or value == 2 or value == 3 or value == 4
        end,

        -- Fast slots selection
        lodOptionSlots = function(value)
            -- It needs to be a whole number between a certain range
            if type(value) ~= 'number' then return false end
            if math.floor(value) ~= value then return false end
            if value < 4 or value > 6 then return false end

            -- Valid
            return true
        end,

        -- Fast ult selection
        lodOptionUlts = function(value)
            -- It needs to be a whole number between a certain range
            if type(value) ~= 'number' then return false end
            if math.floor(value) ~= value then return false end
            if value < 0 or value > 6 then return false end

            -- Valid
            return true
        end,

        -- Fast mirror draft hero selection
        lodOptionMirrorHeroes = function(value)
            -- It needs to be a whole number between a certain range
            if type(value) ~= 'number' then return false end
            if math.floor(value) ~= value then return false end
            if value < 1 or value > 50 then return false end

            -- Valid
            return true
        end,

        -- Common gamemode
        lodOptionCommonGamemode = function(value)
            -- Ensure gamemode is set to custom
            if self.optionStore['lodOptionGamemode'] ~= -1 then return false end

            return value == 1 or value == 3 or value == 4 or value == 5
        end,

        -- Common max slots
        lodOptionCommonMaxSlots = function(value)
            -- Ensure gamemode is set to custom
            if self.optionStore['lodOptionGamemode'] ~= -1 then return false end

            -- It needs to be a whole number between a certain range
            if type(value) ~= 'number' then return false end
            if math.floor(value) ~= value then return false end
            if value < 4 or value > 6 then return false end

            -- Valid
            return true
        end,

        -- Common max skills
        lodOptionCommonMaxSkills = function(value)
            -- Ensure gamemode is set to custom
            if self.optionStore['lodOptionGamemode'] ~= -1 then return false end

            -- It needs to be a whole number between a certain range
            if type(value) ~= 'number' then return false end
            if math.floor(value) ~= value then return false end
            if value < 0 or value > 6 then return false end

            -- Valid
            return true
        end,

        -- Common max ults
        lodOptionCommonMaxUlts = function(value)
            -- Ensure gamemode is set to custom
            if self.optionStore['lodOptionGamemode'] ~= -1 then return false end

            -- It needs to be a whole number between a certain range
            if type(value) ~= 'number' then return false end
            if math.floor(value) ~= value then return false end
            if value < 0 or value > 6 then return false end

            -- Valid
            return true
        end,

        -- Common host banning
        lodOptionBanningHostBanning = function(value)
            -- Ensure gamemode is set to custom
            if self.optionStore['lodOptionGamemode'] ~= -1 then return false end

            return value == 0 or value == 1
        end,

        -- Common max bans
        lodOptionBanningMaxBans = function(value)
            -- Ensure gamemode is set to custom
            if self.optionStore['lodOptionGamemode'] ~= -1 then return false end

            -- It needs to be a whole number between a certain range
            if type(value) ~= 'number' then return false end
            if math.floor(value) ~= value then return false end
            if value < 0 or value > 25 then return false end

            -- Valid
            return true
        end,

        -- Common max hero bans
        lodOptionBanningMaxHeroBans = function(value)
            -- Ensure gamemode is set to custom
            if self.optionStore['lodOptionGamemode'] ~= -1 then return false end

            -- It needs to be a whole number between a certain range
            if type(value) ~= 'number' then return false end
            if math.floor(value) ~= value then return false end
            if value < 0 or value > 5 then return false end

            -- Valid
            return true
        end,

        -- Common mirror draft hero selection
        lodOptionCommonMirrorHeroes = function(value)
            -- Ensure gamemode is set to custom
            if self.optionStore['lodOptionGamemode'] ~= -1 then return false end

            -- It needs to be a whole number between a certain range
            if type(value) ~= 'number' then return false end
            if math.floor(value) ~= value then return false end
            if value < 1 or value > 50 then return false end

            -- Valid
            return true
        end,

        -- Common block troll combos
        lodOptionBanningBlockTrollCombos = function(value)
            -- Ensure gamemode is set to custom
            if self.optionStore['lodOptionGamemode'] ~= -1 then return false end

            return value == 0 or value == 1
        end,

        -- Common use ban list
        lodOptionBanningUseBanList = function(value)
            -- Ensure gamemode is set to custom
            if self.optionStore['lodOptionGamemode'] ~= -1 then return false end

            return value == 0 or value == 1
        end,

        -- Common ban all invis
        lodOptionBanningBanInvis = function(value)
            -- Ensure gamemode is set to custom
            if self.optionStore['lodOptionGamemode'] ~= -1 then return false end

            return value == 0 or value == 1
        end,

        -- Game Speed -- Starting Level
        lodOptionGameSpeedStartingLevel = function(value)
            -- Ensure gamemode is set to custom
            if self.optionStore['lodOptionGamemode'] ~= -1 then return false end

            -- It needs to be a whole number between a certain range
            if type(value) ~= 'number' then return false end
            if math.floor(value) ~= value then return false end
            if value < 1 or value > 100 then return false end

            -- Valid
            return true
        end,

        -- Game Speed -- Max Level
        lodOptionGameSpeedMaxLevel = function(value)
            -- Ensure gamemode is set to custom
            if self.optionStore['lodOptionGamemode'] ~= -1 then return false end

            -- It needs to be a whole number between a certain range
            if type(value) ~= 'number' then return false end
            if math.floor(value) ~= value then return false end
            if value < 6 or value > 100 then return false end

            -- Valid
            return true
        end,

        -- Game Speed -- Starting Gold
        lodOptionGameSpeedStartingGold = function(value)
            -- Ensure gamemode is set to custom
            if self.optionStore['lodOptionGamemode'] ~= -1 then return false end

            -- It needs to be a whole number between a certain range
            if type(value) ~= 'number' then return false end
            if math.floor(value) ~= value then return false end
            if value < 0 or value > 100000 then return false end

            -- Valid
            return true
        end,

        -- Game Speed -- Gold per interval
        lodOptionGameSpeedGoldTickRate = function(value)
            -- Ensure gamemode is set to custom
            if self.optionStore['lodOptionGamemode'] ~= -1 then return false end

            -- It needs to be a whole number between a certain range
            if type(value) ~= 'number' then return false end
            if math.floor(value) ~= value then return false end
            if value < 0 or value > 25 then return false end

            -- Valid
            return true
        end,

        -- Game Speed -- Gold Modifier
        lodOptionGameSpeedGoldModifier = function(value)
            -- Ensure gamemode is set to custom
            if self.optionStore['lodOptionGamemode'] ~= -1 then return false end

            -- It needs to be a whole number between a certain range
            if type(value) ~= 'number' then return false end
            if math.floor(value) ~= value then return false end
            if value < 0 or value > 1000 then return false end

            -- Valid
            return true
        end,

        -- Game Speed -- EXP Modifier
        lodOptionGameSpeedEXPModifier = function(value)
            -- Ensure gamemode is set to custom
            if self.optionStore['lodOptionGamemode'] ~= -1 then return false end

            -- It needs to be a whole number between a certain range
            if type(value) ~= 'number' then return false end
            if math.floor(value) ~= value then return false end
            if value < 0 or value > 1000 then return false end

            -- Valid
            return true
        end,

        -- Game Speed -- Respawn time percentage
        lodOptionGameSpeedRespawnTimePercentage = function(value)
            -- Ensure gamemode is set to custom
            if self.optionStore['lodOptionGamemode'] ~= -1 then return false end

            -- It needs to be a whole number between a certain range
            if type(value) ~= 'number' then return false end
            if math.floor(value) ~= value then return false end
            if value < 0 or value > 100 then return false end

            -- Valid
            return true
        end,

        -- Game Speed -- Respawn time constant
        lodOptionGameSpeedRespawnTimeConstant = function(value)
            -- Ensure gamemode is set to custom
            if self.optionStore['lodOptionGamemode'] ~= -1 then return false end

            -- It needs to be a whole number between a certain range
            if type(value) ~= 'number' then return false end
            if math.floor(value) ~= value then return false end
            if value < 0 or value > 120 then return false end

            -- Valid
            return true
        end,

        -- Game Speed -- Buyback Cooldown
        lodOptionGameSpeedBuybackCooldown = function(value)
            -- Ensure gamemode is set to custom
            if self.optionStore['lodOptionGamemode'] ~= -1 then return false end

            -- It needs to be a whole number between a certain range
            if type(value) ~= 'number' then return false end
            if math.floor(value) ~= value then return false end
            if value < 0 or value > 7 * 60 then return false end

            -- Valid
            return true
        end,

        -- Game Speed -- Towers per lane
        lodOptionGameSpeedTowersPerLane = function(value)
            -- Ensure gamemode is set to custom
            if self.optionStore['lodOptionGamemode'] ~= -1 then return false end

            -- It needs to be a whole number between a certain range
            if type(value) ~= 'number' then return false end
            if math.floor(value) ~= value then return false end
            if value < 3 or value > 10 then return false end

            -- Valid
            return true
        end,

        -- Game Speed - Scepter Upgraded
        lodOptionGameSpeedUpgradedUlts = function(value)
            -- Ensure gamemode is set to custom
            if self.optionStore['lodOptionGamemode'] ~= -1 then return false end

            return value == 0 or value == 1
        end,

        -- Game Speed - Free Courier
        lodOptionGameSpeedFreeCourier = function(value)
            -- Ensure gamemode is set to custom
            if self.optionStore['lodOptionGamemode'] ~= -1 then return false end

            return value == 0 or value == 1
        end,

        -- Game Speed - Voting
        lodOptionGameSpeedVoting = function(value)
            -- Ensure gamemode is set to custom
            if self.optionStore['lodOptionGamemode'] ~= -1 then return false end

            return value == 0 or value == 1 or value == 2
        end,

        -- Bots -- Desired number of radiant players
        lodOptionBotsRadiant = function(value)
            -- Ensure gamemode is set to custom
            if self.optionStore['lodOptionGamemode'] ~= -1 then return false end

            -- It needs to be a whole number between a certain range
            if type(value) ~= 'number' then return false end
            if math.floor(value) ~= value then return false end
            if value < 0 or value > 10 then return false end

            -- Valid
            return true
        end,

        -- Bots -- Desired number of dire players
        lodOptionBotsDire = function(value)
            -- Ensure gamemode is set to custom
            if self.optionStore['lodOptionGamemode'] ~= -1 then return false end

            -- It needs to be a whole number between a certain range
            if type(value) ~= 'number' then return false end
            if math.floor(value) ~= value then return false end
            if value < 0 or value > 10 then return false end

            -- Valid
            return true
        end,

        -- Bots - Unfair EXP balancing
        lodOptionBotsUnfairBalance = function(value)
            -- Ensure gamemode is set to custom
            if self.optionStore['lodOptionGamemode'] ~= -1 then return false end

            return value == 0 or value == 1
        end,

        -- Game Speed - Easy Mode
        --[[lodOptionCrazyEasymode = function(value)
            -- Ensure gamemode is set to custom
            if self.optionStore['lodOptionGamemode'] ~= -1 then return false end

            return value == 0 or value == 1
        end,]]

        -- Advanced -- Enable Hero Abilities
        lodOptionAdvancedHeroAbilities = function(value)
            -- Ensure gamemode is set to custom
            if self.optionStore['lodOptionGamemode'] ~= -1 then return false end

            return value == 0 or value == 1
        end,

        -- Advanced -- Enable Neutral Abilities
        lodOptionAdvancedNeutralAbilities = function(value)
            -- Ensure gamemode is set to custom
            if self.optionStore['lodOptionGamemode'] ~= -1 then return false end

            return value == 0 or value == 1
        end,

        -- Advanced -- Enable Wraith Night Abilities
        lodOptionAdvancedNeutralWraithNight = function(value)
            -- Ensure gamemode is set to custom
            if self.optionStore['lodOptionGamemode'] ~= -1 then return false end

            return value == 0 or value == 1
        end,

        -- Advanced -- Enable Custom Abilities
        lodOptionAdvancedCustomSkills = function(value)
            -- Ensure gamemode is set to custom
            if self.optionStore['lodOptionGamemode'] ~= -1 then return false end

            return value == 0 or value == 1
        end,

        -- Advanced -- Enable OP Abilities
        lodOptionAdvancedOPAbilities = function(value)
            -- Ensure gamemode is set to custom
            if self.optionStore['lodOptionGamemode'] ~= -1 then return false end

            return value == 0 or value == 1
        end,

        -- Advanced -- Hide enemy picks
        lodOptionAdvancedHidePicks = function(value)
            -- Ensure gamemode is set to custom
            if self.optionStore['lodOptionGamemode'] ~= -1 then return false end

            return value == 0 or value == 1
        end,

        -- Advanced -- Unique Skills
        lodOptionAdvancedUniqueSkills = function(value)
            -- Ensure gamemode is set to custom
            if self.optionStore['lodOptionGamemode'] ~= -1 then return false end

            return value == 0 or value == 1 or value == 2
        end,

        -- Advanced -- Unique Heroes
        lodOptionAdvancedUniqueHeroes = function(value)
            -- Ensure gamemode is set to custom
            if self.optionStore['lodOptionGamemode'] ~= -1 then return false end

            return value == 0 or value == 1
        end,

        -- Advanced -- Allow picking primary attr
        lodOptionAdvancedSelectPrimaryAttr = function(value)
            -- Ensure gamemode is set to custom
            if self.optionStore['lodOptionGamemode'] ~= -1 then return false end

            return value == 0 or value == 1
        end,

        -- Other -- No Fountain Camping
        lodOptionCrazyNoCamping = function(value)
            -- Ensure gamemode is set to custom
            if self.optionStore['lodOptionGamemode'] ~= -1 then return false end

            return value == 0 or value == 1
        end,

        -- Other -- Universal Shop
        lodOptionCrazyUniversalShop = function(value)
            -- Ensure gamemode is set to custom
            if self.optionStore['lodOptionGamemode'] ~= -1 then return false end

            return value == 0 or value == 1
        end,

        -- Other -- All Vision
        lodOptionCrazyAllVision = function(value)
            -- Ensure gamemode is set to custom
            if self.optionStore['lodOptionGamemode'] ~= -1 then return false end

            return value == 0 or value == 1
        end,

        -- Other -- Multicast Madness
        lodOptionCrazyMulticast = function(value)
            -- Ensure gamemode is set to custom
            if self.optionStore['lodOptionGamemode'] ~= -1 then return false end

            return value == 0 or value == 1
        end,

        -- Other -- WTF Mode
        lodOptionCrazyWTF = function(value)
            -- Ensure gamemode is set to custom
            if self.optionStore['lodOptionGamemode'] ~= -1 then return false end

            return value == 0 or value == 1
        end,

        -- Other -- Ingame Hero Builder
        lodOptionIngameBuilder = function(value)
            -- Ensure gamemode is set to custom
            if self.optionStore['lodOptionGamemode'] ~= -1 then return false end

            return value == 0 or value == 1
        end,
    }

    -- Callbacks
    self.onOptionsChanged = {
        -- Fast Gamemode
        lodOptionGamemode = function(optionName, optionValue)
            -- If we are using a hard coded gamemode, then, set all options automatically
            if optionValue ~= -1 then
                -- Gamemode is copied
                self:setOption('lodOptionCommonGamemode', optionValue, true)

                -- Total slots is copied
                self:setOption('lodOptionCommonMaxSlots', self.optionStore['lodOptionSlots'], true)

                -- Max skills is always 6
                self:setOption('lodOptionCommonMaxSkills', 6, true)

                -- Max ults is copied
                self:setOption('lodOptionCommonMaxUlts', self.optionStore['lodOptionUlts'], true)

                -- Set banning
                self:setOption('lodOptionBanning', 1)

                -- Block troll combos is always on
                self:setOption('lodOptionBanningBlockTrollCombos', 1, true)

                -- Default, we don't ban all invisiblity
                self:setOption('lodOptionBanningBanInvis', 0, true)

                -- Starting level is lvl 1
                self:setOption('lodOptionGameSpeedStartingLevel', 1, true)

                -- Max level is 25
                self:setOption('lodOptionGameSpeedMaxLevel', 25, true)

                -- Don't mess with gold rate
                self:setOption('lodOptionGameSpeedStartingGold', 0, true)
                self:setOption('lodOptionGameSpeedGoldTickRate', 1, true)
                self:setOption('lodOptionGameSpeedGoldModifier', 100, true)
                self:setOption('lodOptionGameSpeedEXPModifier', 100, true)

                -- Default respawn time
                self:setOption('lodOptionGameSpeedRespawnTimePercentage', 100, true)
                self:setOption('lodOptionGameSpeedRespawnTimeConstant', 0, true)

                -- Default buyback cooldown
                self:setOption('lodOptionGameSpeedBuybackCooldown', 7 * 60, true)

                -- 3 Towers per lane
                self:setOption('lodOptionGameSpeedTowersPerLane', 3, true)

                -- Do not start scepter upgraded
                self:setOption('lodOptionGameSpeedUpgradedUlts', 0, true)

                -- Start with a free courier
                self:setOption('lodOptionGameSpeedFreeCourier', 1, true)

                -- Voting starts at everyone required
                self:setOption('lodOptionGameSpeedVoting', 0, true)

                -- Set bot options
                self:setOption('lodOptionBotsRadiant', 0, true)
                self:setOption('lodOptionBotsDire', 0, true)
                self:setOption('lodOptionBotsUnfairBalance', 1, true)

                -- Turn easy mode off
                --self:setOption('lodOptionCrazyEasymode', 0, true)

                -- Enable hero abilities
                self:setOption('lodOptionAdvancedHeroAbilities', 1, true)

                -- Enable neutral abilities
                self:setOption('lodOptionAdvancedNeutralAbilities', 1, true)

                -- Enable Wraith Night abilities
                self:setOption('lodOptionAdvancedNeutralWraithNight', 1, true)

                -- Enable Custom Abilities
                self:setOption('lodOptionAdvancedCustomSkills', 1, true)

                -- Disable OP abilities
                self:setOption('lodOptionAdvancedOPAbilities', 1, true)

                -- Hide enemy picks
                self:setOption('lodOptionAdvancedHidePicks', 1, true)

                -- Disable Unique Skills
                self:setOption('lodOptionAdvancedUniqueSkills', 0, true)

                -- Disable Unique Heroes
                self:setOption('lodOptionAdvancedUniqueHeroes', 0, true)

                -- Enable picking primary attr
                self:setOption('lodOptionAdvancedSelectPrimaryAttr', 1, true)

                -- Disable Fountain Camping
                self:setOption('lodOptionCrazyNoCamping', 1, true)

                -- Enable Universal Shop
                self:setOption('lodOptionCrazyUniversalShop', 1, true)

                -- Disable All Vision
                self:setOption('lodOptionCrazyAllVision', 0, true)

                -- Disable Multicast Madness
                self:setOption('lodOptionCrazyMulticast', 0, true)

                -- Disable WTF Mode
                self:setOption('lodOptionCrazyWTF', 0, true)

                -- Disable ingame hero builder
                self:setOption('lodOptionIngameBuilder', 0, true)

                -- Fast All Pick Mode
                if optionValue == 2 then
                    -- Set gamemode to all pick
                    self:setOption('lodOptionCommonGamemode', 1, true)

                    -- Set respawn to 10%
                    self:setOption('lodOptionGameSpeedRespawnTimePercentage', 10, true)
                    self:setOption('lodOptionGameSpeedRespawnTimeConstant', 0, true)

                    -- Buyback cooldown really low
                    self:setOption('lodOptionGameSpeedBuybackCooldown', 60, true)

                    -- Starting level is lvl 6
                    self:setOption('lodOptionGameSpeedStartingLevel', 6, true)

                    -- Turn easy mode on
                    --self:setOption('lodOptionCrazyEasymode', 1, true)

                    -- Start with 2500 bonus gold
                    self:setOption('lodOptionGameSpeedStartingGold', 2500, true)
                    self:setOption('lodOptionGameSpeedGoldTickRate', 5, true)
                    self:setOption('lodOptionGameSpeedGoldModifier', 250, true)
                    self:setOption('lodOptionGameSpeedEXPModifier', 250, true)
                end
            end
        end,

        -- Fast Banning
        lodOptionBanning = function(optionName, optionValue)
            -- No host banning phase
            self:setOption('lodOptionBanningHostBanning', 0, true)

            if self.optionStore['lodOptionBanning'] == 1 then
                -- Balanced Bans
                self:setOption('lodOptionBanningMaxBans', 0, true)
                self:setOption('lodOptionBanningMaxHeroBans', 0, true)
                self:setOption('lodOptionBanningUseBanList', 1, true)
            elseif self.optionStore['lodOptionBanning'] == 2 then
                -- Fast Banning Phase
                self:setOption('lodOptionBanningMaxBans', self.fastBansTotalBans, true)
                self:setOption('lodOptionBanningMaxHeroBans', self.fastHeroBansTotalBans, true)
                self:setOption('lodOptionBanningUseBanList', 0, true)
            elseif self.optionStore['lodOptionBanning'] == 3 then
                -- Full Banning Phase
                self:setOption('lodOptionBanningMaxBans', self.fullBansTotalBans, true)
                self:setOption('lodOptionBanningMaxHeroBans', self.fullHeroBansTotalBans, true)
                self:setOption('lodOptionBanningUseBanList', 1, true)
            else
                -- No Banning
                self:setOption('lodOptionBanningMaxBans', 0, true)
                self:setOption('lodOptionBanningMaxHeroBans', 0, true)
                self:setOption('lodOptionBanningUseBanList', 0, true)
            end
        end,

        -- Fast max slots
        lodOptionSlots = function(optionName, optionValue)
            -- Copy max slots in
            self:setOption('lodOptionCommonMaxSlots', self.optionStore['lodOptionSlots'], true)
        end,

        -- Fast max ults
        lodOptionUlts = function(optionName, optionValue)
            self:setOption('lodOptionCommonMaxUlts', self.optionStore['lodOptionUlts'], true)
        end,

        -- Fast mirror draft
        lodOptionMirrorHeroes = function()
            self:setOption('lodOptionCommonMirrorHeroes', self.optionStore['lodOptionMirrorHeroes'], true)
        end,

        -- Common mirror draft heroes
        lodOptionCommonMirrorHeroes = function()
            self.maxDraftHeroes = self.optionStore['lodOptionCommonMirrorHeroes']
        end
    }
end

-- Generates a random build
function Pregame:generateRandomBuild(playerID, buildID)
    -- Default filter allows all heroes
    local filter = function() return true end

    local this = self

    if buildID == 0 then
        -- A strength based hero only
        filter = function(heroName)
            return this.heroPrimaryAttr[heroName] == 'str'
        end
    elseif buildID == 1 then
        -- A Agility melee based hero only
        filter = function(heroName)
            return this.heroPrimaryAttr[heroName] == 'agi' and this.heroRole[heroName] == 'melee'
        end
    elseif buildID == 2 then
        -- A Agility ranged based hero only
        filter = function(heroName)
            return this.heroPrimaryAttr[heroName] == 'agi' and this.heroRole[heroName] == 'ranged'
        end

    elseif buildID == 3 then
        -- A int based hero only
        filter = function(heroName)
            return this.heroPrimaryAttr[heroName] == 'int'
        end
    elseif buildID == 4 then
        -- Any hero except agility
        filter = function(heroName)
            return this.heroPrimaryAttr[heroName] ~= 'agi'
        end
    end

    local heroName = self:getRandomHero(filter)
    local build = {}

    -- Validate it
    local maxSlots = self.optionStore['lodOptionCommonMaxSlots']

    for slot=1,maxSlots do
        -- Grab a random ability
        local newAbility = self:findRandomSkill(build, slot, playerID)

        -- Ensure we found an ability
        if newAbility ~= nil then
            build[slot] = newAbility
        end
    end

    -- Return the data
    return heroName, build
end

-- Generates builds for all random mode
function Pregame:generateAllRandomBuilds()
    -- Only process this once
    if self.allRandomBuilds then return end
    self.allRandomBuilds = {}

    -- Generate 10 builds
    local minPlayerID = 0
    local maxPlayerID = 24

    -- Max builds per player
    local maxPlayerBuilds = 5

    for playerID = minPlayerID,maxPlayerID-1 do
        local theBuilds = {}

        for buildID = 0,(maxPlayerBuilds-1) do
            local heroName, build = self:generateRandomBuild(playerID, buildID)

            theBuilds[buildID] = {
                heroName = heroName,
                build = build
            }
        end

        -- Store and network
        self.allRandomBuilds[playerID] = theBuilds
        network:setAllRandomBuild(playerID, theBuilds)

        -- Highlight which build is selected
        self.selectedRandomBuilds[playerID] = {
            hero = 0,
            build = 0
        }
        network:setSelectedAllRandomBuild(playerID, self.selectedRandomBuilds[playerID])

        -- Assign the skills
        self.selectedSkills[playerID] = theBuilds[0].build
        network:setSelectedAbilities(playerID, self.selectedSkills[playerID])

        -- Must be valid, select it
        local heroName = theBuilds[0].heroName

        if self.selectedHeroes[playerID] ~= heroName then
            self.selectedHeroes[playerID] = heroName
            network:setSelectedHero(playerID, heroName)

            -- Attempt to set the primary attribute
            local newAttr = self.heroPrimaryAttr[heroName] or 'str'
            if self.selectedPlayerAttr[playerID] ~= newAttr then
                -- Update local store
                self.selectedPlayerAttr[playerID] = newAttr

                -- Update the selected hero
                network:setSelectedAttr(playerID, newAttr)
            end
        end
    end
end

-- Generates draft arrays
function Pregame:buildDraftArrays()
    -- Only build draft arrays once
    if self.draftArrays then return end
    self.draftArrays = {}

    local maxDraftArrays = 12

    if self.singleDraft then
        maxDraftArrays = 24
    end

    local draftPlayers = {}
    for playerID=0,24 do
    	local draftID = self:getDraftID(playerID)

    	if not draftPlayers[draftID] then
    		draftPlayers[draftID] = {}
    	end

    	draftPlayers[draftID][playerID] = true
    end

    for draftID = 0,(maxDraftArrays - 1) do
        -- Create store for data
        local draftData = {}
        self.draftArrays[draftID] = draftData

        local possibleHeroes = {}
        for k,v in pairs(self.allowedHeroes) do
            table.insert(possibleHeroes, k)
        end

        -- Select random heroes
        local heroDraft = {}
        for i=1,self.maxDraftHeroes do
            heroDraft[table.remove(possibleHeroes, math.random(#possibleHeroes))] = true
        end

        local possibleSkills = {}
        for abilityName,_ in pairs(self.flagsInverse) do
            local shouldAdd = true

            -- check bans
            if self.bannedAbilities[abilityName] then
                shouldAdd = false
            end

            -- Should we add it?
            if shouldAdd then
                table.insert(possibleSkills, abilityName)
            end
        end

        -- Select random skills
        local abilityDraft = {}
        for i=1,self.maxDraftSkills do
            abilityDraft[table.remove(possibleSkills, math.random(#possibleSkills))] = true
        end

        -- Store data
        draftData.heroDraft = heroDraft
        draftData.abilityDraft = abilityDraft

        -- Network data
        network:setDraftArray(draftID, draftData, draftPlayers[draftID] or {})
    end
end

-- Precaches builds
local donePrecaching = false
function Pregame:precacheBuilds()
    local allSkills = {}
    local alreadyAdded = {}

    local timerDelay = 0

    for k,v in pairs(self.selectedSkills) do
        for kk,vv in pairs(v) do
            if not alreadyAdded[vv] then
                alreadyAdded[vv] = true
                table.insert(allSkills, vv)
            end
        end
    end

    local allPlayerIDs = {}
    for i=0,24 do
        if PlayerResource:IsValidPlayerID(i) then
            table.insert(allPlayerIDs, i)
        end
    end

    local this = self

    local totalToCache = #allPlayerIDs + #allSkills

    function checkCachingComplete()
        totalToCache = totalToCache - 1

        if totalToCache == 0 then
            donePrecaching = true

            -- Tell clients
            network:donePrecaching()

            -- Check for ready
            this:checkForReady()
            return
        end
    end

    function continueCachingHeroes()
        --print('continue caching hero')

        -- Any more to cache?
        if #allPlayerIDs <= 0 then
            --[[donePrecaching = true

            -- Tell clients
            network:donePrecaching()

            -- Check for ready
            this:checkForReady()]]
            return
        end

        local playerID = table.remove(allPlayerIDs, 1)

        if PlayerResource:IsValidPlayerID(playerID) then
            local heroName = self.selectedHeroes[playerID]

            if heroName then
                -- Store that it is cached
                this.cachedPlayerHeroes[playerID] = true

                --print('Caching ' .. heroName)

                PrecacheUnitByNameAsync(heroName, function()
                    -- Are we done
                    checkCachingComplete()
                end, playerID)

                -- Continue
                Timers:CreateTimer(function()
                    continueCachingHeroes()
                end, DoUniqueString('keepCaching'), timerDelay)
            else
                Timers:CreateTimer(function()
                    continueCachingHeroes()
                end, DoUniqueString('keepCaching'), timerDelay)
            end
        else
            Timers:CreateTimer(function()
                continueCachingHeroes()
            end, DoUniqueString('keepCaching'), timerDelay)
        end
    end

    function continueCaching()
        --print('Continue caching!')

        Timers:CreateTimer(function()
            if #allSkills > 0 then
                local abName = table.remove(allSkills, 1)

                --print('Precaching ' .. abName)

                SkillManager:precacheSkill(abName, function()
                    -- Check if caching has completed
                    checkCachingComplete()
                end)

                -- Keep Caching
                continueCaching()
            end
        end, DoUniqueString('keepCaching'), timerDelay)
    end

    -- Start caching process
    continueCaching()
    continueCachingHeroes()
end

-- Validates builds
function Pregame:validateBuilds()
    -- Only process this once
    if self.validatedBuilds then return end
    self.validatedBuilds = true

    -- Generate 10 builds
    local minPlayerID = 0
    local maxPlayerID = 24

    -- Validate it
    local maxSlots = self.optionStore['lodOptionCommonMaxSlots']

    -- Loop over all playerIDs
    for playerID = minPlayerID,maxPlayerID-1 do
        -- Ensure they have a hero
        if not self.selectedHeroes[playerID] then
            local heroName = self:getRandomHero()
            self.selectedHeroes[playerID] = heroName
            network:setSelectedHero(playerID, heroName)

            -- Attempt to set the primary attribute
            local newAttr = self.heroPrimaryAttr[heroName] or 'str'
            if self.selectedPlayerAttr[playerID] ~= newAttr then
                -- Update local store
                self.selectedPlayerAttr[playerID] = newAttr

                -- Update the selected hero
                network:setSelectedAttr(playerID, newAttr)
            end
        end

        -- Grab their build
        local build = self.selectedSkills[playerID]

        -- Ensure they have a build
        if not build then
            build = {}
            self.selectedSkills[playerID] = build
        end

        for slot=1,maxSlots do
            if not build[slot] then
                -- Grab a random ability
                local newAbility = self:findRandomSkill(build, slot, playerID)

                -- Ensure we found an ability
                if newAbility ~= nil then
                    build[slot] = newAbility
                end
            end
        end

        -- Network it
        network:setSelectedAbilities(playerID, build)
    end
end

-- Processes options to push around to the rest of the systems
function Pregame:processOptions()
    -- Only process options once
    if self.processedOptions then return end
    self.processedOptions = true

    local this = self

    local status,err = pcall(function()
    	-- Push settings externally where possible
	    OptionManager:SetOption('startingLevel', this.optionStore['lodOptionGameSpeedStartingLevel'])
	    OptionManager:SetOption('bonusGold', this.optionStore['lodOptionGameSpeedStartingGold'])
	    OptionManager:SetOption('maxHeroLevel', this.optionStore['lodOptionGameSpeedMaxLevel'])
	    OptionManager:SetOption('multicastMadness', this.optionStore['lodOptionCrazyMulticast'] == 1)
        OptionManager:SetOption('respawnModifierPercentage', this.optionStore['lodOptionGameSpeedRespawnTimePercentage'])
	    OptionManager:SetOption('respawnModifierConstant', this.optionStore['lodOptionGameSpeedRespawnTimeConstant'])
	    OptionManager:SetOption('freeScepter', this.optionStore['lodOptionGameSpeedUpgradedUlts'] == 1)
        OptionManager:SetOption('freeCourier', this.optionStore['lodOptionGameSpeedFreeCourier'] == 1)

	    OptionManager:SetOption('votingMode', this.optionStore['lodOptionGameSpeedVoting'])

        if this.optionStore['lodOptionGameSpeedVoting'] == 0 then
            network:disableVoting()
        end

	    -- Enforce max level
	    if OptionManager:GetOption('startingLevel') > OptionManager:GetOption('maxHeroLevel') then
	        this.optionStore['lodOptionGameSpeedStartingLevel'] = this.optionStore['lodOptionGameSpeedMaxLevel']
	        OptionManager:SetOption('startingLevel', OptionManager:GetOption('maxHeroLevel'))
	    end

	    -- Enable easy mode
	    --[[if this.optionStore['lodOptionCrazyEasymode'] == 1 then
	        Convars:SetInt('dota_easy_mode', 1)
	    end]]

	    -- Gold per interval
	    GameRules:SetGoldPerTick(this.optionStore['lodOptionGameSpeedGoldTickRate'])
	    OptionManager:SetOption('goldModifier', this.optionStore['lodOptionGameSpeedGoldModifier'])
	    OptionManager:SetOption('expModifier', this.optionStore['lodOptionGameSpeedEXPModifier'])

	    -- Bot options
	    this.desiredRadiant = this.optionStore['lodOptionBotsRadiant']
	    this.desiredDire = this.optionStore['lodOptionBotsDire']

	    -- Enable WTF mode
	    if this.optionStore['lodOptionCrazyWTF'] == 1 then
	        -- Auto ban powerful abilities
	        for abilityName,v in pairs(this.wtfAutoBan) do
	        	this:banAbility(abilityName)
	        end

	        -- Enable debug mode
	        Convars:SetBool('dota_ability_debug', true)
	    end

        -- Enable ingame hero builder
        if this.optionStore['lodOptionIngameBuilder'] == 1 then
            OptionManager:SetOption('allowIngameHeroBuilder', true)
            network:enableIngameHeroEditor()
        end

	    -- Banning of OP Skills
	    if this.optionStore['lodOptionAdvancedOPAbilities'] == 1 then
	        for abilityName,v in pairs(this.OPSkillsList) do
	            this:banAbility(abilityName)
	        end
	    else
	    	SpellFixes:SetOPMode(true)
	    end

	    -- Banning invis skills
	    if this.optionStore['lodOptionBanningBanInvis'] == 1 then
	        for abilityName,v in pairs(this.invisSkills) do
	            this:banAbility(abilityName)
	        end
	    end

	    -- LoD ban list
	    if this.optionStore['lodOptionBanningUseBanList'] == 1 then
	        for abilityName,v in pairs(this.lodBanList) do
	            this:banAbility(abilityName)
	        end
	    end

	    -- Enable Universal Shop
	    if this.optionStore['lodOptionCrazyUniversalShop'] == 1 then
	        GameRules:SetUseUniversalShopMode(true)
	    end

	    -- Enable All Vision
	    if this.optionStore['lodOptionCrazyAllVision'] == 1 then
	        Convars:SetBool('dota_all_vision', true)
	    end

	    -- Buyback cooldown
	    OptionManager:SetOption('buybackCooldown', this.optionStore['lodOptionGameSpeedBuybackCooldown'])

	    if OptionManager:GetOption('maxHeroLevel') ~= 25 then
	        GameRules:GetGameModeEntity():SetCustomXPRequiredToReachNextLevel(constants.XP_PER_LEVEL_TABLE)
	        GameRules:GetGameModeEntity():SetCustomHeroMaxLevel(OptionManager:GetOption('maxHeroLevel'))
	        GameRules:GetGameModeEntity():SetUseCustomHeroLevels(true)
	    end

	    -- Check what kind of flags we should be recording
	    if this.useOptionVoting then
	    	-- We are using option voting

	    	-- Did anyone actually post to the banning bote?
	    	if this.optionVotingBanning ~= nil then
	    		-- Someone actually voted
	    		statCollection:setFlags({
			        ['Voting Banning Enabled'] = this.optionVotingBanning
			    })
	    	end
	    else
	    	-- We are using option selection
	    	if this.optionStore['lodOptionGamemode'] == -1 then
                local votingText = 'Disabled'
                if this.optionStore['lodOptionGameSpeedVoting'] == 1 then
                    votingText = 'Everyone must vote yes.'
                elseif this.optionStore['lodOptionGameSpeedVoting'] == 2 then
                    votingText = '50% + 1'
                end

	    		-- Players can pick all options, store all options
			    statCollection:setFlags({
			        ['Preset Gamemode'] = this.optionStore['lodOptionGamemode'],
			        ['Gamemode'] = this.optionStore['lodOptionCommonGamemode'],
			        ['Max Slots'] = this.optionStore['lodOptionCommonMaxSlots'],
			        ['Max Skills'] = this.optionStore['lodOptionCommonMaxSkills'],
			        ['Max Ults'] = this.optionStore['lodOptionCommonMaxUlts'],
			        ['Host Banning'] = this.optionStore['lodOptionBanningHostBanning'],
			        ['Max Ability Bans'] = this.optionStore['lodOptionBanningMaxBans'],
			        ['Max Hero Bans'] = this.optionStore['lodOptionBanningMaxHeroBans'],
			        ['Block Troll Combos'] = this.optionStore['lodOptionBanningBlockTrollCombos'],
			        ['Use LoD BanList'] = this.optionStore['lodOptionBanningUseBanList'],
			        ['Block OP Abilities'] = this.optionStore['lodOptionAdvancedOPAbilities'],
			        ['Block Invis Abilities'] = this.optionStore['lodOptionBanningBanInvis'],
			        ['Starting Level'] = this.optionStore['lodOptionGameSpeedStartingLevel'],
			        ['Max Hero Level'] = this.optionStore['lodOptionGameSpeedMaxLevel'],
			        ['Bonus Starting Gold'] = this.optionStore['lodOptionGameSpeedStartingGold'],
			        ['Gold Per Tick'] = this.optionStore['lodOptionGameSpeedGoldTickRate'],
			        ['Gold Modifier'] = math.floor(this.optionStore['lodOptionGameSpeedGoldModifier']),
			        ['XP Modifier'] = math.floor(this.optionStore['lodOptionGameSpeedEXPModifier']),
		            ['Respawn Modifier Percentage'] = math.floor(this.optionStore['lodOptionGameSpeedRespawnTimePercentage']),
			        ['Respawn Modifier Constant'] = this.optionStore['lodOptionGameSpeedRespawnTimeConstant'],
			        ['Buyback Cooldown'] = this.optionStore['lodOptionGameSpeedBuybackCooldown'],
			        ['Towers Per Lane'] = this.optionStore['lodOptionGameSpeedTowersPerLane'],
			        ['Start With Upgraded Ults'] = this.optionStore['lodOptionGameSpeedUpgradedUlts'],
                    ['Start With Free Courier'] = this.optionStore['lodOptionGameSpeedFreeCourier'],
			        ['Voting'] = votingText,
			        ['Allow Hero Abilities'] = this.optionStore['lodOptionAdvancedHeroAbilities'],
			        ['Allow Neutral Abilities'] = this.optionStore['lodOptionAdvancedNeutralAbilities'],
                    ['Allow Wraith Night Skills'] = this.optionStore['lodOptionAdvancedNeutralWraithNight'],
			        ['Allow Custom Skills'] = this.optionStore['lodOptionAdvancedCustomSkills'],
			        ['Hide Enemy Picks'] = this.optionStore['lodOptionAdvancedHidePicks'],
			        ['Unique Skills'] = this.optionStore['lodOptionAdvancedUniqueSkills'],
			        ['Unique Heroes'] = this.optionStore['lodOptionAdvancedUniqueHeroes'],
			        ['Allow Selecting Primary Attribute'] = this.optionStore['lodOptionAdvancedSelectPrimaryAttr'],
			        ['Stop Fountain Camping'] = this.optionStore['lodOptionCrazyNoCamping'],
			        ['Enable Universal Shop'] = this.optionStore['lodOptionCrazyUniversalShop'],
			        ['Enable All Vision'] = this.optionStore['lodOptionCrazyAllVision'],
			        ['Enable Multicast Madness'] = this.optionStore['lodOptionCrazyMulticast'],
                    ['Enable WTF Mode'] = this.optionStore['lodOptionCrazyWTF'],
			        ['Enable Ingame Hero Builder'] = this.optionStore['lodOptionIngameBuilder'],
			    })

				-- Draft arrays
				if this.useDraftArrays then
					statCollection:setFlags({
				        ['Draft Heroes'] = this.optionStore['lodOptionMirrorHeroes'],
				    })
				end
			else
				-- Store presets
				statCollection:setFlags({
			        ['Preset Gamemode'] = this.optionStore['lodOptionGamemode'],
			        ['Preset Banning'] = this.optionStore['lodOptionBanning'],
			        ['Preset Max Slots'] = this.optionStore['lodOptionSlots'],
			        ['Preset Max Ults'] = this.optionStore['lodOptionUlts'],
			    })

				-- Store draft array setting if it is being used
			    if this.useDraftArrays then
			    	statCollection:setFlags({
				        ['Preset Draft Heroes'] = this.optionStore['lodOptionCommonMirrorHeroes'],
				    })
			    end
	    	end
	    end



		-- If bots are enabled, add a bots flags
		if this.enabledBots then
			statCollection:setFlags({
                ['Bots Enabled'] = 1,
                ['Desired Radiant Bots'] = this.optionStore['lodOptionBotsRadiant'],
                ['Desired Dire Bots'] = this.optionStore['lodOptionBotsDire']
			})
		else
			statCollection:setFlags({
                ['Bots Enabled'] = 0,
			})
		end

		-- Challenge mode
		if this.challengeMode then
			statCollection:setFlags({
				['Challenge Mode'] = challenge:getChallengeName()
			})
		end
    end)

	-- Did it fail?
	if not status then
		SendToServerConsole('say "Post this to the LoD comments section: '..err:gsub('"',"''")..'"')
	end
end

-- Validates, and then sets an option
function Pregame:setOption(optionName, optionValue, force)
    -- option validator

    if not self.validOptions[optionName] then
        -- Tell the user they tried to modify an invalid option
        network:sendNotification(player, {
            sort = 'lodDanger',
            text = 'lodFailedToFindOption',
            params = {
            	['optionName'] = optionName
        	}
        })

        return
    end

    if not force and not self.validOptions[optionName](optionValue) then
        -- Tell the user they gave an invalid value
        network:sendNotification(player, {
            sort = 'lodDanger',
            text = 'lodFailedToSetOptionValue',
            params = {
	            ['optionName'] = optionName,
            	['optionValue'] = optionValue
        	}
        })

        return
    end

    -- Set the option
    self:updateOption(optionName, optionValue)

    -- Check for option changing callbacks
    if self.onOptionsChanged[optionName] then
        self.onOptionsChanged[optionName](optionName, optionValue)
    end
end

-- Networks an options
function Pregame:updateOption(optionName, optionValue)
    self.optionStore[optionName] = optionValue
    network:setOption(optionName, optionValue)
end

-- Bans an ability
function Pregame:banAbility(abilityName)
    if not self.bannedAbilities[abilityName] then
        -- Do the ban
        self.bannedAbilities[abilityName] = true
        network:banAbility(abilityName)

        return true
    end

    return false
end

-- Bans a hero
function Pregame:banHero(heroName)
	if not self.bannedHeroes[heroName] then
        -- Do the ban
        self.bannedHeroes[heroName] = true
        network:banHero(heroName)

        return true
    end

    return false
end

-- Returns a player's draft index
function Pregame:getDraftID(playerID)
    -- If it's single draft, just use our playerID
    if self.singleDraft then
        return playerID
    end

    local maxPlayers = 24

    local theirTeam = PlayerResource:GetTeam(playerID)

    local draftID = 0
    for i=0,(maxPlayers - 1) do
        -- Stop when we hit our playerID
        if playerID == i then break end

        if PlayerResource:GetTeam(i) == theirTeam then
            draftID = draftID + 1
            if draftID > 4 then
                draftID = 0
            end
        end
    end

    return draftID
end

-- Tries to set a player's selected hero
function Pregame:setSelectedHero(playerID, heroName, force)
    -- Grab the player so we can push messages
    local player = PlayerResource:GetPlayer(playerID)

    -- Validate hero
    if not self.allowedHeroes[heroName] then
        -- Add an error
        network:sendNotification(player, {
            sort = 'lodDanger',
            text = 'lodFailedToFindHero'
        })

        return
    end

    -- Check forced stuff
    if not force then
        -- Is this hero banned?
        -- Validate the ability isn't already banned
        if self.bannedHeroes[heroName] then
            -- hero is banned
            network:sendNotification(player, {
                sort = 'lodDanger',
                text = 'lodFailedHeroIsBanned',
                params = {
                    ['heroName'] = heroName
                }
            })

            return
        end

        -- Is unique heroes on?
        if self.optionStore['lodOptionAdvancedUniqueHeroes'] == 1 then
            for thePlayerID,theSelectedHero in pairs(self.selectedHeroes) do
                if theSelectedHero == heroName then
                    -- Tell them
                    network:sendNotification(player, {
                        sort = 'lodDanger',
                        text = 'lodFailedHeroIsTaken',
                        params = {
                            ['heroName'] = heroName
                        }
                    })

                    return
                end
            end
        end

        -- Check draft array
        if self.useDraftArrays then
            local draftID = self:getDraftID(playerID)
            local draftArray = self.draftArrays[draftID] or {}
            local heroDraft = draftArray.heroDraft

            if self.maxDraftHeroes > 0 then
                if not heroDraft[heroName] then
                    -- Tell them
                    network:sendNotification(player, {
                        sort = 'lodDanger',
                        text = 'lodFailedDraftWrongHero',
                        params = {
                            ['heroName'] = heroName
                        }
                    })

                    return
                end
            end
        end
    end

    -- Attempt to set the primary attribute
    local newAttr = self.heroPrimaryAttr[heroName] or 'str'
    if self.selectedPlayerAttr[playerID] ~= newAttr then
        -- Update local store
        self.selectedPlayerAttr[playerID] = newAttr

        -- Update the selected hero
        network:setSelectedAttr(playerID, newAttr)
    end

    -- Is there an actual change?
    if self.selectedHeroes[playerID] ~= heroName then
        -- Update local store
        self.selectedHeroes[playerID] = heroName

        -- Update the selected hero
        network:setSelectedHero(playerID, heroName)
    end
end

-- Returns true if a player is allowed to select stuff
function Pregame:canSelectStuff()
    if self:getPhase() == constants.PHASE_SELECTION then
        return true
    end

    if self:getPhase() == constants.PHASE_INGAME then
        if OptionManager:GetOption('allowIngameHeroBuilder') then
            return true
        end
    end

    return false
end

-- Player wants to select a hero
function Pregame:onPlayerSelectHero(eventSourceIndex, args)
    -- Grab data
    local playerID = args.PlayerID
    local player = PlayerResource:GetPlayer(playerID)

    -- Ensure we are in the picking phase
    if not self:canSelectStuff() then
        -- Ensure we are in the picking phase
        if not self:canSelectStuff() then
            network:sendNotification(player, {
                sort = 'lodDanger',
                text = 'lodFailedWrongPhaseSelection'
            })

            return
        end

        return
    end

    -- Have they locked their skills?
    if self.isReady[playerID] == 1 then
        network:sendNotification(player, {
            sort = 'lodDanger',
            text = 'lodFailedPlayerIsReady'
        })

        return
    end

    -- Attempt to select the hero
    self:setSelectedHero(playerID, args.heroName)
end

-- Attempts to set a player's attribute
function Pregame:setSelectedAttr(playerID, newAttr)
    local player = PlayerResource:GetPlayer(playerID)

    -- Validate that the option is enabled
    if self.optionStore['lodOptionAdvancedSelectPrimaryAttr'] == 0 then
        -- Add an error
        network:sendNotification(player, {
            sort = 'lodDanger',
            text = 'lodFailedToChangeAttr'
        })

        return
    end

    -- Validate the new attribute
    if newAttr ~= 'str' and newAttr ~= 'agi' and newAttr ~= 'int' then
        -- Add an error
        network:sendNotification(player, {
            sort = 'lodDanger',
            text = 'lodFailedToChangeAttrInvalid'
        })

        return
    end

    -- Is there an actual change?
    if self.selectedPlayerAttr[playerID] ~= newAttr then
        -- Update local store
        self.selectedPlayerAttr[playerID] = newAttr

        -- Update the selected hero
        network:setSelectedAttr(playerID, newAttr)
    end
end

-- Player wants to select a new primary attribute
function Pregame:onPlayerSelectAttr(eventSourceIndex, args)
    -- Grab data
    local playerID = args.PlayerID
    local player = PlayerResource:GetPlayer(playerID)

    -- Have they locked their skills?
    if self.isReady[playerID] == 1 then
        network:sendNotification(player, {
            sort = 'lodDanger',
            text = 'lodFailedPlayerIsReady'
        })

        return
    end

    -- Ensure we are in the picking phase
    if not self:canSelectStuff() then
        network:sendNotification(player, {
            sort = 'lodDanger',
            text = 'lodFailedWrongPhaseSelection'
        })

        return
    end

    -- Attempt to set it
    self:setSelectedAttr(playerID, args.newAttr)
end

-- Player is asking for a new build to be applied
function Pregame:onPlayerAskForNewBuild(eventSourceIndex, args)
    -- Grab data
    local playerID = args.PlayerID
    local player = PlayerResource:GetPlayer(playerID)

    -- Ensure we can select stuff and that we are ingame
    if not self:canSelectStuff() then return end
    if self:getPhase() ~= constants.PHASE_INGAME then return end

    -- Apply the new build
    GameRules.ingame:spawnUpdatedBuild(playerID)
end

-- Player is asking why they don't have a hero
function Pregame:onPlayerAskForHero(eventSourceIndex, args)
    -- This code only works during the game phase
    if self:getPhase() ~= constants.PHASE_INGAME then return end

    -- Grab data
    local playerID = args.PlayerID
    local player = PlayerResource:GetPlayer(playerID)

    -- Has this player already asked for their hero?
    if self.spawnedHeroesFor[playerID] then
    	-- Do they have a hero?
    	if PlayerResource:GetSelectedHeroEntity(playerID) ~= nil then
    		return
    	end

    	if not self.requestHeroAgain then
    		self.requestHeroAgain = {}
    	end

    	if self.requestHeroAgain[playerID] then
    		if Time() > self.requestHeroAgain[playerID] then
    			self.requestHeroAgain[playerID] = nil
    			self.currentlySpawning = false
    			self.spawnedHeroesFor[playerID] = false
    		end
    	else
    		-- Allocate 3 seconds then allow them to spawn a hero
    		self.requestHeroAgain[playerID] = Time() + 3
    	end
    end

    -- Attempt to spawn a hero (this is validated inside to prevent multiple heroes)
    self:spawnPlayer(playerID)
end

-- Player wants to select an entire build
function Pregame:onPlayerSelectBuild(eventSourceIndex, args)
    -- Grab data
    local playerID = args.PlayerID
    local player = PlayerResource:GetPlayer(playerID)

    -- Ensure we are in the picking phase
    if not self:canSelectStuff() then
        network:sendNotification(player, {
            sort = 'lodDanger',
            text = 'lodFailedWrongPhaseSelection'
        })

        return
    end

    -- Have they locked their skills?
    if self.isReady[playerID] == 1 then
        network:sendNotification(player, {
            sort = 'lodDanger',
            text = 'lodFailedPlayerIsReady'
        })

        return
    end

    -- Grab the stuff
    local hero = args.hero
    local attr = args.attr
    local build = args.build

    -- Do we need to change our hero?
    if self.selectedHeroes ~= hero then
        -- Set the hero
        self:setSelectedHero(playerID, hero)
    end

    -- Do we have a different attr?
    if self.selectedPlayerAttr[playerID] ~= attr then
        -- Attempt to set it
        self:setSelectedAttr(playerID, attr)
    end

    -- Grab number of slots
    local maxSlots = self.optionStore['lodOptionCommonMaxSlots']

    -- Reset the player's build
    self.selectedSkills[playerID] = {}

    for slotID=1,maxSlots do
        if build[tostring(slotID)] ~= nil then
            self:setSelectedAbility(playerID, slotID, build[tostring(slotID)], true)
        end
    end

    -- Perform the networking
    network:setSelectedAbilities(playerID, self.selectedSkills[playerID])
end

-- Player wants to select an all random build
function Pregame:onPlayerSelectAllRandomBuild(eventSourceIndex, args)
    local playerID = args.PlayerID
    local player = PlayerResource:GetPlayer(playerID)

    -- Player shouldn't be able to do this unless it is the all random phase
    if self:getPhase() ~= constants.PHASE_RANDOM_SELECTION then
        network:sendNotification(player, {
            sort = 'lodDanger',
            text = 'lodFailedNotAllRandomPhase'
        })
        return
    end

    -- Read options
    local buildID = args.buildID
    local heroOnly = args.heroOnly == 1

    -- Validate builds
    local builds = self.allRandomBuilds[playerID]
    if builds == nil then
        network:sendNotification(player, {
            sort = 'lodDanger',
            text = 'lodFailedAllRandomNoBuilds'
        })
        return
    end

    local build = builds[tonumber(buildID)]
    if build == nil then
        network:sendNotification(player, {
            sort = 'lodDanger',
            text = 'lodFailedAllRandomInvalidBuild',
            params = {
                ['buildID'] = buildID
            }
        })
        return
    end

    -- Are we meant to set the hero or hte build?
    if not heroOnly then
        -- Push the build
        self.selectedSkills[playerID] = build.build
        network:setSelectedAbilities(playerID, build.build)

        -- Change which build has been selected
        self.selectedRandomBuilds[playerID].build = buildID
        network:setSelectedAllRandomBuild(playerID, self.selectedRandomBuilds[playerID])
    else
        -- Must be valid, select it
        local heroName = build.heroName

        if self.selectedHeroes[playerID] ~= heroName then
            self.selectedHeroes[playerID] = heroName
            network:setSelectedHero(playerID, heroName)

            -- Attempt to set the primary attribute
            local newAttr = self.heroPrimaryAttr[heroName] or 'str'
            if self.selectedPlayerAttr[playerID] ~= newAttr then
                -- Update local store
                self.selectedPlayerAttr[playerID] = newAttr

                -- Update the selected hero
                network:setSelectedAttr(playerID, newAttr)
            end
        end

        -- Change which hero has been selected
        self.selectedRandomBuilds[playerID].hero = buildID
        network:setSelectedAllRandomBuild(playerID, self.selectedRandomBuilds[playerID])
    end
end

-- Player wants to lock their build
function Pregame:onPlayerLockBuild(eventSourceIndex, args)
    -- They can't lock their build too early
    if self:getPhase() < constants.PHASE_SELECTION then return end

    -- Ensure stuff exists
    local playerID = args.PlayerID
    local player = PlayerResource:GetPlayer(playerID)

    self.lockedBuilds[playerID] = self.lockedBuilds[playerID] or 0

    -- Are we in the selection phase?
    if self:getPhase() == constants.PHASE_SELECTION then
        -- Allow toggling
        self.lockedBuilds[playerID] = (self.lockedBuilds[playerID] == 1 and 0) or 1

        -- Move the ready state based on the lock state
        self.isReady[playerID] = self.lockedBuilds[playerID]

        -- Check for ready
        self:checkForReady()

        -- Done
        return
    end

    -- Only allow locking
    if self.lockedBuilds[playerID] == 1 then
        -- Build is already locked
        network:sendNotification(player, {
            sort = 'lodDanger',
            text = 'lodUnlockFailedWrongPhase'
        })
        return
    end

    -- Lock the build
    self.lockedBuilds[playerID] = 1

    -- Network locked build state
    network:sendReadyState(self.isReady, self.lockedBuilds)
end

-- Player wants to ready up
function Pregame:onPlayerReady(eventSourceIndex, args)
    if self:getPhase() ~= constants.PHASE_BANNING and self:getPhase() ~= constants.PHASE_SELECTION and self:getPhase() ~= constants.PHASE_RANDOM_SELECTION and self:getPhase() ~= constants.PHASE_REVIEW then return end

    local playerID = args.PlayerID

    -- Ensure we have a store for this player's ready state
    self.isReady[playerID] = self.isReady[playerID] or 0

    -- Toggle their state
    self.isReady[playerID] = (self.isReady[playerID] == 1 and 0) or 1

    -- Checks if people are ready
    self:checkForReady()
end

-- Checks if people are ready
function Pregame:checkForReady()
    -- Network it
    network:sendReadyState(self.isReady, self.lockedBuilds)

    local currentTime = self.endOfTimer - Time()
    local maxTime = OptionManager:GetOption('pickingTime')
    local minTime = 3

    -- If we are in the banning phase
    if self:getPhase() == constants.PHASE_BANNING then
        maxTime = OptionManager:GetOption('banningTime')
    end

    -- If we are in the random phase
    if self:getPhase() == constants.PHASE_RANDOM_SELECTION then
        maxTime = OptionManager:GetOption('randomSelectionTime')
    end

    -- If we are in the review phase
    if self:getPhase() == constants.PHASE_REVIEW then
        maxTime = OptionManager:GetOption('reviewTime')

        -- Caching must complete first!
        if not donePrecaching then return end
    end

    -- Calculate how many players are ready
    local totalPlayers = self:getActivePlayers()
    local readyPlayers = 0

    -- Is the host ready?
    local hostReady = false

    for playerID,readyState in pairs(self.isReady) do
        -- Ensure the player is connected AND ready
        if readyState == 1 then
        	if PlayerResource:GetConnectionState(playerID) == 2 then
	            readyPlayers = readyPlayers + 1
	        end
        end

        -- Host checking
        local thePly = PlayerResource:GetPlayer(playerID)
        if thePly and GameRules:PlayerHasCustomGameHostPrivileges(thePly) then
        	if readyState == 1 or PlayerResource:GetConnectionState(playerID) ~= 2 then
        		-- Host is ready
        		hostReady = true
        	end
        end
    end

    -- Are we currently in the baning phase?
    if self:getPhase() == constants.PHASE_BANNING then
	    -- Check if host banning is enabled
	    if self.optionStore['lodOptionBanningHostBanning'] == 1 and self.optionStore['lodOptionBanningMaxBans'] <= 0 and self.optionStore['lodOptionBanningMaxHeroBans'] <= 0 then
	    	-- Is the host ready?
	    	if hostReady then
	    		-- Everyone is ready
	    		readyPlayers = totalPlayers
	    	else
	    		-- Max banning time is 4x what it normally would be
	    		-- This is done to prevent the host from preventing the game from progressing
	    		maxTime = maxTime * 4
	    	end
	    end
	end

    -- Is there at least one player that is ready?
    if readyPlayers > 0 then
        -- Someone is ready, timer should be moving

        -- Is time currently frozen?
        if self.freezeTimer ~= nil then
            -- Start the clock

            if readyPlayers >= totalPlayers then
                -- Single player
                self:setEndOfPhase(Time() + minTime)
            else
                -- Multiplayer, start the timer ticking
                self:setEndOfPhase(Time() + maxTime)
            end
        else
            -- Check if we can lower the timer

            -- If everyone is ready, set the remaining time to be the min
            if readyPlayers >= totalPlayers then
                if currentTime > minTime then
                    self:setEndOfPhase(Time() + minTime)
                end
            else
                local percentageReady = (readyPlayers-1) / totalPlayers

                local discountTime = maxTime * (1-percentageReady) * 1.5

                if discountTime < currentTime then
                    self:setEndOfPhase(Time() + discountTime)
                end
            end
        end
    else
        -- No one is ready, freeze time at max
        self:setEndOfPhase(Time() + maxTime, maxTime)
    end
end

-- Player wants to ban an ability
function Pregame:onPlayerBan(eventSourceIndex, args)
    -- Grab data
    local playerID = args.PlayerID
    local player = PlayerResource:GetPlayer(playerID)

	-- Ensure we are in the banning phase
    if self:getPhase() ~= constants.PHASE_BANNING then
        network:sendNotification(player, {
            sort = 'lodDanger',
            text = 'lodFailedWrongPhaseBanning'
        })

        return
    end

	local usedBans = self.usedBans

    -- Ensure we have a store
    usedBans[playerID] = usedBans[playerID] or {
    	heroBans = 0,
    	abilityBans = 0
	}

	-- Grab the ban object
	local playerBans = usedBans[playerID]

	-- Grab settings
	local maxBans = self.optionStore['lodOptionBanningMaxBans']
	local maxHeroBans = self.optionStore['lodOptionBanningMaxHeroBans']

    local unlimitedBans = false
    if self.optionStore['lodOptionBanningHostBanning'] == 1 and GameRules:PlayerHasCustomGameHostPrivileges(player) then
        unlimitedBans = true
    end

	-- Check what kind of ban it is
	local heroName = args.heroName
	local abilityName = args.abilityName

	-- Default is heroBan
	if heroName ~= nil then
		-- Check the number of bans
		if playerBans.heroBans >= maxHeroBans and not unlimitedBans then
            if maxHeroBans == 0 then
                -- There is no hero banning
                network:sendNotification(player, {
                    sort = 'lodDanger',
                    text = 'lodFailedBanHeroNoBanning'
                })

                return
            else
                -- Player has used all their bans
                network:sendNotification(player, {
                    sort = 'lodDanger',
                    text = 'lodFailedBanHeroLimit',
                    params = {
                        ['used'] = playerBans.heroBans,
                        ['max'] = maxHeroBans
                    }
                })
            end

			return
		end

		-- Is this a valid hero?
		if not self.allowedHeroes[heroName] then
	        -- Add an error
	        network:sendNotification(player, {
	            sort = 'lodDanger',
	            text = 'lodFailedToFindHero'
	        })

	        return
	    end

	    -- Perform the ban
		if self:banHero(heroName) then
			-- Success

			network:broadcastNotification({
	            sort = 'lodSuccess',
	            text = 'lodSuccessBanHero',
	            params = {
	            	['heroName'] = heroName
	        	}
	        })

            -- Increase the number of ability bans this player has done
            playerBans.heroBans = playerBans.heroBans + 1

            -- Network how many bans have been used
            network:setTotalBans(playerID, playerBans.heroBans, playerBans.abilityBans)
		else
			-- Ability was already banned

			network:sendNotification(player, {
	            sort = 'lodDanger',
	            text = 'lodFailedBanHeroAlreadyBanned',
	            params = {
	            	['heroName'] = heroName
	        	}
	        })

            return
		end
	elseif abilityName ~= nil then
		-- Check the number of bans
		if playerBans.abilityBans >= maxBans and not unlimitedBans then
            if maxBans == 0 then
                -- No ability banning allowed
                network:sendNotification(player, {
                    sort = 'lodDanger',
                    text = 'lodFailedBanAbilityNoBanning'
                })

                return
            else
                -- Player has used all their bans
                network:sendNotification(player, {
                    sort = 'lodDanger',
                    text = 'lodFailedBanAbilityLimit',
                    params = {
                        ['used'] = playerBans.abilityBans,
                        ['max'] = maxBans
                    }
                })
            end

			return
		end

		-- Is this even a real skill?
	    if not self.flagsInverse[abilityName] then
	        -- Invalid ability name
	        network:sendNotification(player, {
	            sort = 'lodDanger',
	            text = 'lodFailedInvalidAbility',
	            params = {
	                ['abilityName'] = abilityName
	            }
	        })

	        return
	    end

		-- Perform the ban
		if self:banAbility(abilityName) then
			-- Success

			network:broadcastNotification({
	            sort = 'lodSuccess',
	            text = 'lodSuccessBanAbility',
	            params = {
	            	['abilityName'] = 'DOTA_Tooltip_ability_' .. abilityName
	        	}
	        })

            -- Increase the number of bans this player has done
            playerBans.abilityBans = playerBans.abilityBans + 1

            -- Network how many bans have been used
            network:setTotalBans(playerID, playerBans.heroBans, playerBans.abilityBans)
		else
			-- Ability was already banned

			network:sendNotification(player, {
	            sort = 'lodDanger',
	            text = 'lodFailedBanAbilityAlreadyBanned',
	            params = {
	            	['abilityName'] = 'DOTA_Tooltip_ability_' .. abilityName
	        	}
	        })

            return
		end
	end

    -- Have they hit the ban limit?
    if playerBans.heroBans >= maxHeroBans and playerBans.abilityBans >= maxBans and not unlimitedBans then
        -- Toggle their state
        self.isReady[playerID] =  1

        -- Checks if people are ready
        self:checkForReady()
    end
end

-- Player wants to select a random ability
function Pregame:onPlayerSelectRandomAbility(eventSourceIndex, args)
    -- Grab data
    local playerID = args.PlayerID
    local player = PlayerResource:GetPlayer(playerID)

	-- Ensure we are in the picking phase
    if not self:canSelectStuff() then
        network:sendNotification(player, {
            sort = 'lodDanger',
            text = 'lodFailedWrongPhaseAllRandom'
        })

        return
    end

    -- Have they locked their skills?
    if self.isReady[playerID] == 1 then
        network:sendNotification(player, {
            sort = 'lodDanger',
            text = 'lodFailedPlayerIsReady'
        })

        return
    end

    local slot = math.floor(tonumber(args.slot))

    local maxSlots = self.optionStore['lodOptionCommonMaxSlots']
    local maxRegulars = self.optionStore['lodOptionCommonMaxSkills']
    local maxUlts = self.optionStore['lodOptionCommonMaxUlts']

    -- Ensure a container for this player exists
    self.selectedSkills[playerID] = self.selectedSkills[playerID] or {}

    local build = self.selectedSkills[playerID]

    -- Validate the slot is a valid slot index
    if slot < 1 or slot > maxSlots then
        -- Invalid slot number
        network:sendNotification(player, {
            sort = 'lodDanger',
            text = 'lodFailedInvalidSlot'
        })

        return
    end

    -- Grab a random ability
    local newAbility = self:findRandomSkill(build, slot, playerID)

    if newAbility == nil then
    	-- No ability found, report error
    	network:sendNotification(player, {
            sort = 'lodDanger',
            text = 'lodFailedNoValidAbilities'
        })

        return
    else
    	-- Store it
        build[slot] = newAbility

        -- Network it
        network:setSelectedAbilities(playerID, build)
    end
end

-- Tries to set which ability is in the given slot
function Pregame:setSelectedAbility(playerID, slot, abilityName, dontNetwork)
    -- Grab the player so we can push messages
    local player = PlayerResource:GetPlayer(playerID)

    -- Grab settings
    local maxSlots = self.optionStore['lodOptionCommonMaxSlots']
    local maxRegulars = self.optionStore['lodOptionCommonMaxSkills']
    local maxUlts = self.optionStore['lodOptionCommonMaxUlts']

    -- Ensure a container for this player exists
    self.selectedSkills[playerID] = self.selectedSkills[playerID] or {}

    local build = self.selectedSkills[playerID]

    -- Grab what the new build would be, to run tests against it
    local newBuild = SkillManager:grabNewBuild(build, slot, abilityName)

    -- Validate the slot is a valid slot index
    if slot < 1 or slot > maxSlots then
        -- Invalid slot number
        network:sendNotification(player, {
            sort = 'lodDanger',
            text = 'lodFailedInvalidSlot'
        })

        return
    end

    -- Validate ability is an actual ability
    if not self.flagsInverse[abilityName] then
        -- Invalid ability name
        network:sendNotification(player, {
            sort = 'lodDanger',
            text = 'lodFailedInvalidAbility',
            params = {
                ['abilityName'] = abilityName
            }
        })

        return
    end

    -- Check draft array
    if self.useDraftArrays then
        local draftID = self:getDraftID(playerID)
        local draftArray = self.draftArrays[draftID] or {}
        local heroDraft = draftArray.heroDraft
        local abilityDraft = draftArray.abilityDraft

        if self.maxDraftHeroes > 0 then
            local heroName = self.abilityHeroOwner[abilityName]

            if not heroDraft[heroName] then
                -- Tell them
                network:sendNotification(player, {
                    sort = 'lodDanger',
                    text = 'lodFailedDraftWrongHeroAbility',
                    params = {
                        ['abilityName'] = 'DOTA_Tooltip_ability_' .. abilityName
                    }
                })

                return
            end
        end

        if self.maxDraftSkills > 0 then
            if not abilityDraft[abilityName] then
                -- Tell them
                network:sendNotification(player, {
                    sort = 'lodDanger',
                    text = 'lodFailedDraftWrongAbility',
                    params = {
                        ['abilityName'] = 'DOTA_Tooltip_ability_' .. abilityName
                    }
                })

                return
            end
        end
    end

    -- Don't allow picking banned abilities
    if self.bannedAbilities[abilityName] then
        -- Invalid ability name
        network:sendNotification(player, {
            sort = 'lodDanger',
            text = 'lodFailedSkillIsBanned',
            params = {
                ['abilityName'] = 'DOTA_Tooltip_ability_' .. abilityName
            }
        })

        return
    end

    -- Validate that the ability is allowed in this slot (ulty count)
    if SkillManager:hasTooMany(newBuild, maxUlts, function(ab)
        return SkillManager:isUlt(ab)
    end) then
        -- Invalid ability name
        network:sendNotification(player, {
            sort = 'lodDanger',
            text = 'lodFailedTooManyUlts',
            params = {
                ['maxUlts'] = maxUlts
            }
        })

        return
    end

    -- Validate that the ability is allowed in this slot (regular count)
    if SkillManager:hasTooMany(newBuild, maxRegulars, function(ab)
        return not SkillManager:isUlt(ab)
    end) then
        -- Invalid ability name
        network:sendNotification(player, {
            sort = 'lodDanger',
            text = 'lodFailedTooManyRegulars',
            params = {
                ['maxRegulars'] = maxRegulars
            }
        })

        return
    end

    -- Do they already have this ability?
    for k,v in pairs(build) do
        if k ~= slot and v == abilityName then
            -- Invalid ability name
            network:sendNotification(player, {
                sort = 'lodDanger',
                text = 'lodFailedAlreadyGotSkill',
                params = {
                    ['abilityName'] = 'DOTA_Tooltip_ability_' .. abilityName
                }
            })

            return
        end
    end

    -- Is the ability in one of the allowed categories?
    local cat = (self.flagsInverse[abilityName] or {}).category
    if cat then
        if not self:isSkillCategoryAllowed(cat) then
            network:sendNotification(player, {
                sort = 'lodDanger',
                text = 'lodFailedBannedCategory',
                params = {
                    ['cat'] = 'lodCategory_' .. cat,
                    ['ab'] = 'DOTA_Tooltip_ability_' .. abilityName
                }
            })

            return
        end
    else
        -- Category not found, don't allow this skill

        network:sendNotification(player, {
            sort = 'lodDanger',
            text = 'lodFailedUnknownCategory',
            params = {
                ['ab'] = 'DOTA_Tooltip_ability_' .. abilityName
            }
        })

        return
    end

    -- Should we block troll combinations?
    if self.optionStore['lodOptionBanningBlockTrollCombos'] == 1 then
        -- Validate that it isn't a troll build
        local isTrollCombo, ab1, ab2 = self:isTrollCombo(newBuild)
        if isTrollCombo then
            -- Invalid ability name
            network:sendNotification(player, {
                sort = 'lodDanger',
                text = 'lodFailedTrollCombo',
                params = {
                    ['ab1'] = 'DOTA_Tooltip_ability_' .. ab1,
                    ['ab2'] = 'DOTA_Tooltip_ability_' .. ab2
                }
            })

            return
        end
    end

    -- Consider unique skills
    if self.optionStore['lodOptionAdvancedUniqueSkills'] == 1 then
        local team = PlayerResource:GetTeam(playerID)

        for thePlayerID,theBuild in pairs(self.selectedSkills) do
            -- Ensure the team matches up
            if team == PlayerResource:GetTeam(thePlayerID) then
                for theSlot,theAbility in pairs(theBuild) do
                    if theAbility == abilityName then
                        -- Skill is taken
                        network:sendNotification(player, {
                            sort = 'lodDanger',
                            text = 'lodFailedSkillTaken',
                            params = {
                                ['ab'] = 'DOTA_Tooltip_ability_' .. abilityName
                            }
                        })

                        return
                    end
                end
            end
        end
    elseif self.optionStore['lodOptionAdvancedUniqueSkills'] == 2 then
        for playerID,theBuild in pairs(self.selectedSkills) do
            for theSlot,theAbility in pairs(theBuild) do
                if theAbility == abilityName then
                    -- Skill is taken
                    network:sendNotification(player, {
                        sort = 'lodDanger',
                        text = 'lodFailedSkillTaken',
                        params = {
                            ['ab'] = 'DOTA_Tooltip_ability_' .. abilityName
                        }
                    })

                    return
                end
            end
        end
    end

    -- Is there an actual change?
    if build[slot] ~= abilityName then
        -- New ability in this slot
        build[slot] = abilityName

        -- Should we network it
        if not dontNetwork then
            -- Network it
            network:setSelectedAbilities(playerID, build)
        end
    end
end

-- Player wants to select a new ability
function Pregame:onPlayerSelectAbility(eventSourceIndex, args)
    -- Grab data
    local playerID = args.PlayerID
    local player = PlayerResource:GetPlayer(playerID)

    -- Ensure we are in the picking phase
    if not self:canSelectStuff() then
        network:sendNotification(player, {
            sort = 'lodDanger',
            text = 'lodFailedWrongPhaseSelection'
        })

        return
    end

    -- Have they locked their skills?
    if self.isReady[playerID] == 1 then
        network:sendNotification(player, {
            sort = 'lodDanger',
            text = 'lodFailedPlayerIsReady'
        })

        return
    end

    local slot = math.floor(tonumber(args.slot))
    local abilityName = args.abilityName

    -- Attempt to set the ability
    self:setSelectedAbility(playerID, slot, abilityName)
end

-- Player wants to swap two slots
function Pregame:onPlayerSwapSlot(eventSourceIndex, args)
    -- Ensure we are in the picking phase
    if not self:canSelectStuff() and self:getPhase() ~= constants.PHASE_REVIEW then return end

    -- Grab data
    local playerID = args.PlayerID
    local player = PlayerResource:GetPlayer(playerID)

    local slot1 = math.floor(tonumber(args.slot1))
    local slot2 = math.floor(tonumber(args.slot2))

    local maxSlots = self.optionStore['lodOptionCommonMaxSlots']

    -- Ensure a container for this player exists
    self.selectedSkills[playerID] = self.selectedSkills[playerID] or {}

    local build = self.selectedSkills[playerID]

    -- Ensure they are not the same slot
    if slot1 == slot2 then
    	-- Invalid ability name
        network:sendNotification(player, {
            sort = 'lodDanger',
            text = 'lodFailedSwapSlotSameSlot'
        })

        return
    end

    -- Ensure both the slots are valid
    if slot1 < 1 or slot1 > maxSlots or slot2 < 1 or slot2 > maxSlots then
    	-- Invalid ability name
        network:sendNotification(player, {
            sort = 'lodDanger',
            text = 'lodFailedSwapSlotInvalidSlots'
        })

        return
    end

    -- Perform the slot
    local tempSkill = build[slot1]
    build[slot1] = build[slot2]
    build[slot2] = tempSkill

    -- Network it
    network:setSelectedAbilities(playerID, build)
end

-- Checks if a given skill category is allowed
function Pregame:isSkillCategoryAllowed(cat)
    if cat == 'main' then
        return self.optionStore['lodOptionAdvancedHeroAbilities'] == 1
    elseif cat == 'neutral' then
        return self.optionStore['lodOptionAdvancedNeutralAbilities'] == 1
    elseif cat == 'wraith' then
        return self.optionStore['lodOptionAdvancedNeutralWraithNight'] == 1
    elseif cat == 'custom' then
        return self.optionStore['lodOptionAdvancedCustomSkills'] == 1
    elseif cat == 'OP' then
        return self.optionStore['lodOptionAdvancedOPAbilities'] == 0
    end

    return false
end

-- Returns a random skill for a player, given a build and the slot the skill would be for
-- optionalFilter is a function(abilityName), return true to allow that ability
function Pregame:findRandomSkill(build, slotNumber, playerID, optionalFilter)
    local team = PlayerResource:GetTeam(playerID)

	-- Ensure we have a valid build
	build = build or {}

	-- Table that will contain all possible skills
	local possibleSkills = {}

	-- Grab the limits
	local maxRegulars = self.optionStore['lodOptionCommonMaxSkills']
    local maxUlts = self.optionStore['lodOptionCommonMaxUlts']

    -- Count how many ults
    local totalUlts = 0
    local totalNormal = 0

    for slotID,abilityName in pairs(build) do
    	if slotID ~= slotNumber then
    		if SkillManager:isUlt(abilityName) then
    			totalUlts = totalUlts + 1
    		else
    			totalNormal = totalNormal + 1
    		end
    	end
    end

	for abilityName,_ in pairs(self.flagsInverse) do
		-- Do we already have this ability / is this in vilation of our troll combos

		local shouldAdd = true

        -- Prevent certain skills from being randomed
        if self.doNotRandom[abilityName] then
            shouldAdd = false
        end

		-- consider ulty count
		if shouldAdd and SkillManager:isUlt(abilityName) then
			if totalUlts >= maxUlts then
				shouldAdd = false
			end
		else
			if totalNormal >= maxRegulars then
				shouldAdd = false
			end
		end

        local cat = (self.flagsInverse[abilityName] or {}).category
        if shouldAdd and cat then
            if not self:isSkillCategoryAllowed(cat) then
                shouldAdd = false
            end
        else
            -- Category not found, don't allow this skill
            shouldAdd = false
        end

		-- Check draft array
        if self.useDraftArrays then
            local draftID = self:getDraftID(playerID)
            local draftArray = self.draftArrays[draftID] or {}
            local heroDraft = draftArray.heroDraft or {}
            local abilityDraft = draftArray.abilityDraft or {}

            if self.maxDraftHeroes > 0 then
                local heroName = self.abilityHeroOwner[abilityName]

                if not heroDraft[heroName] then
                    shouldAdd = false
                end
            end

            if self.maxDraftSkills > 0 then
                if not abilityDraft[abilityName] then
                    shouldAdd = false
                end
            end
        end

        -- Consider unique skills
        if self.optionStore['lodOptionAdvancedUniqueSkills'] == 1 then
            for playerID,theBuild in pairs(self.selectedSkills) do
                -- Ensure the team matches up
                if team == PlayerResource:GetTeam(playerID) then
                    for theSlot,theAbility in pairs(theBuild) do
                        if theAbility == abilityName then
                            shouldAdd = false
                            break
                        end
                    end
                end
            end
        elseif self.optionStore['lodOptionAdvancedUniqueSkills'] == 2 then
            for playerID,theBuild in pairs(self.selectedSkills) do
                for theSlot,theAbility in pairs(theBuild) do
                    if theAbility == abilityName then
                        shouldAdd = false
                        break
                    end
                end
            end
        end

		-- check bans
		if self.bannedAbilities[abilityName] then
			shouldAdd = false
		end

		for slotNumber,abilityInSlot in pairs(build) do
			if abilityName == abilityInSlot then
				shouldAdd = false
				break
			end

			if self.banList[abilityName] and self.banList[abilityName][abilityInSlot] then
				shouldAdd = false
				break
			end
		end

        if shouldAdd and optionalFilter ~= nil then
            if not optionalFilter(abilityName) then
                shouldAdd = false
            end
        end

		-- Should we add it?
		if shouldAdd then
			table.insert(possibleSkills, abilityName)
		end
	end

	-- Are there any possible skills for this slot?
	if #possibleSkills == 0 then
		return nil
	end

	-- Pick a random skill to return
	return possibleSkills[math.random(#possibleSkills)]
end

-- Sets the stage
function Pregame:setPhase(newPhaseNumber)
    -- Store the current phase
    self.currentPhase = newPhaseNumber

    -- Update the phase for the clients
    network:setPhase(newPhaseNumber)

    -- Ready state should reset
    for k,v in pairs(self.isReady) do
        self.isReady[k] = 0
    end

    -- Network it
    network:sendReadyState(self.isReady, self.lockedBuilds)
end

-- Sets when the next phase is going to end
function Pregame:setEndOfPhase(endTime, freezeTimer)
    -- Store the time
    self.endOfTimer = endTime

    -- Network it
    network:setEndOfPhase(endTime)

    -- Should we freeze the timer?
    if freezeTimer then
        self.freezeTimer = freezeTimer
        network:freezeTimer(freezeTimer)
    else
        self.freezeTimer = nil
        network:freezeTimer(-1)
    end
end

-- Returns when the current phase should end
function Pregame:getEndOfPhase()
    return self.endOfTimer
end

-- Returns the current phase
function Pregame:getPhase()
    return self.currentPhase
end

-- Calculates how many players are in the server
function Pregame:getActivePlayers()
    local total = 0

    for i=0,24 do
        if PlayerResource:GetConnectionState(i) == 2 then
            total = total + 1
        end
    end

    return total
end

-- Adds extra towers
-- Adds extra towers
function Pregame:addExtraTowers()
    local totalMiddleTowers = self.optionStore['lodOptionGameSpeedTowersPerLane'] - 2

    -- Is there any work to do?
    if totalMiddleTowers > 1 then
        -- Create a store for tower connectors
        self.towerConnectors = {}

        local lanes = {
            top = true,
            mid = true,
            bot = true
        }

        local teams = {
            good = DOTA_TEAM_GOODGUYS,
            bad = DOTA_TEAM_BADGUYS
        }

        local patchMap = {
            dota_goodguys_tower3_top = '1021_tower_radiant',
            dota_goodguys_tower3_mid = '1020_tower_radiant',
            dota_goodguys_tower3_bot = '1019_tower_radiant',

            dota_goodguys_tower2_top = '1026_tower_radiant',
            dota_goodguys_tower2_mid = '1024_tower_radiant',
            dota_goodguys_tower2_bot = '1022_tower_radiant',

            dota_goodguys_tower1_top = '1027_tower_radiant',
            dota_goodguys_tower1_mid = '1025_tower_radiant',
            dota_goodguys_tower1_bot = '1023_tower_radiant',

            dota_badguys_tower3_top = '1036_tower_dire',
            dota_badguys_tower3_mid = '1031_tower_dire',
            dota_badguys_tower3_bot = '1030_tower_dire',

            dota_badguys_tower2_top = '1035_tower_dire',
            dota_badguys_tower2_mid = '1032_tower_dire',
            dota_badguys_tower2_bot = '1029_tower_dire',

            dota_badguys_tower1_top = '1034_tower_dire',
            dota_badguys_tower1_mid = '1033_tower_dire',
            dota_badguys_tower1_bot = '1028_tower_dire',
        }

        for team,teamNumber in pairs(teams) do
            for lane,__ in pairs(lanes) do
                local threeRaw = 'dota_'..team..'guys_tower3_'..lane
                local three = Entities:FindByName(nil, threeRaw) or Entities:FindByName(nil, patchMap[threeRaw] or '_unknown_')

                local twoRaw = 'dota_'..team..'guys_tower2_'..lane
                local two = Entities:FindByName(nil, twoRaw) or Entities:FindByName(nil, patchMap[twoRaw] or '_unknown_')

                local oneRaw = 'dota_'..team..'guys_tower1_'..lane
                local one = Entities:FindByName(nil, oneRaw) or Entities:FindByName(nil, patchMap[oneRaw] or '_unknown_')

                -- Unit name
                local unitName = 'npc_dota_'..team..'guys_tower_lod_'..lane

                if one and two and three then
                    -- Proceed to patch the towers
                    local onePos = one:GetOrigin()
                    local threePos = three:GetOrigin()

                    -- Workout the difference in the positions
                    local dif = threePos - onePos
                    local sep = dif / (totalMiddleTowers + 1)

                    -- Remove the middle tower
                    UTIL_Remove(two)

                    -- Used to connect towers
                    local prevTower = three

                    for i=1,totalMiddleTowers do
                        local newPos = threePos - (sep * i)

                        local newTower = CreateUnitByName(unitName, newPos, false, nil, nil, teamNumber)

                        if newTower then
                            -- Make it unkillable
                            newTower:AddNewModifier(ent, nil, 'modifier_invulnerable', {})

                            -- Store connection
                            self.towerConnectors[newTower] = prevTower
                            prevTower = newTower
                        else
                            print('Failed to create tower #'..i..' in lane '..lane)
                        end
                    end

                    -- Store initial connection
                    self.towerConnectors[one] = prevTower
                else
                    -- Failure
                    print('Failed to patch towers!')
                end
            end
        end

        -- Hook the towers properly
        local this = self

        ListenToGameEvent('entity_hurt', function(keys)
            -- Grab the entity that was hurt
            local ent = EntIndexToHScript(keys.entindex_killed)

            -- Check for tower connections
            if ent:GetHealth() <= 0 and this.towerConnectors[ent] then
                local tower = this.towerConnectors[ent]
                this.towerConnectors[ent] = nil

                if IsValidEntity(tower) then
                    -- Make it killable!
                    tower:RemoveModifierByName('modifier_invulnerable')
                end
            end
        end, nil)
    end
end

-- Prevents Fountain Camping
function Pregame:preventCamping()
    -- Should we prevent fountain camping?
    if self.optionStore['lodOptionCrazyNoCamping'] == 1 then
        local toAdd = {
            ursa_fury_swipes = 4,
            templar_assassin_psi_blades = 1,
            slark_essence_shift = 4
        }

        local fountains = Entities:FindAllByClassname('ent_dota_fountain')
        -- Loop over all ents
        for k,fountain in pairs(fountains) do
            for skillName,skillLevel in pairs(toAdd) do
                fountain:AddAbility(skillName)
                local ab = fountain:FindAbilityByName(skillName)
                if ab then
                    ab:SetLevel(skillLevel)
                end
            end

            local item = CreateItem('item_monkey_king_bar', fountain, fountain)
            if item then
                fountain:AddItem(item)
            end
        end
    end
end

-- Counts how many people on radiant and dire
function Pregame:countRadiantDire()
    local maxplayerID = 24
    local totalRadiant = 0
    local totalDire = 0

    -- Work out how many bots are going to be needed
    for playerID=0,maxplayerID-1 do
        local state = PlayerResource:GetConnectionState(playerID)

        if state ~= 0 then
            if PlayerResource:GetTeam(playerID) == DOTA_TEAM_GOODGUYS then
                totalRadiant = totalRadiant + 1
            elseif PlayerResource:GetTeam(playerID) == DOTA_TEAM_BADGUYS then
                totalDire = totalDire + 1
            end
        end
    end

    return totalRadiant, totalDire
end

function Pregame:addBots(team, count)
    -- Grab number of players
    local totalRadiant, totalDire = self:countRadiantDire()

    -- The amount we have added
    local totalAdded = 0

    local addedPlayers = {}

    -- Add radiant players
    while totalAdded < count do
        local playerID = totalRadiant + totalDire + totalAdded

        table.insert(addedPlayers, playerID)

        totalAdded = totalAdded + 1
        Tutorial:AddBot('', '', 'unfair', true)

        local ply = PlayerResource:GetPlayer(playerID)
        if ply then
            local store = {
                ply = ply,
                team = team
            }

            -- Store this bot player
            if team == DOTA_TEAM_GOODGUYS then
                self.botPlayers.radiant[playerID] = store
            elseif team == DOTA_TEAM_BADGUYS then
                self.botPlayers.dire[playerID] = store
            end
            self.botPlayers.all[playerID] = store

            -- Push them onto the correct team
            PlayerResource:SetCustomTeamAssignment(playerID, team)
        end
    end

    return addedPlayers
end

-- Adds bot players to the game
function Pregame:addBotPlayers()
	-- Ensure bots should actually be added
	if self.addedBotPlayers then return end
	self.addedBotPlayers = true

    -- Make the team sizes huge
    GameRules:SetCustomGameTeamMaxPlayers(DOTA_TEAM_GOODGUYS, DOTA_MAX_TEAM_PLAYERS)
    GameRules:SetCustomGameTeamMaxPlayers(DOTA_TEAM_BADGUYS, DOTA_MAX_TEAM_PLAYERS)

    -- Create the store for bot players
    self.botPlayers = {
        radiant = {},
        dire = {},
        all = {}
    }

    -- Do we need to actually add bots?
	if not self.enabledBots then return end

	-- Settings to determine how many players to place onto each team
	self.desiredRadiant = self.desiredRadiant or 5
	self.desiredDire = self.desiredDire or 5

    -- Adjust the team sizes
    --GameRules:SetCustomGameTeamMaxPlayers(DOTA_TEAM_GOODGUYS, self.desiredRadiant)
    --GameRules:SetCustomGameTeamMaxPlayers(DOTA_TEAM_BADGUYS, self.desiredDire)

    -- Grab number of players
    local totalRadiant, totalDire = self:countRadiantDire()

    self:addBots(DOTA_TEAM_GOODGUYS, self.desiredRadiant - totalRadiant)
    self:addBots(DOTA_TEAM_BADGUYS, self.desiredDire - totalDire)
end

-- Generate builds for bots
function Pregame:generateBotBuilds()
    -- Ensure bots are actually enabled
    --if not self.enabledBots then return end

    -- Ensure we have bot players allocated
    if not self.botPlayers.all then return end

    -- Create a table to store bot builds
    --self.botBuilds = {}

    -- List of bots that are borked
    local brokenBots = {
        npc_dota_hero_tidehunter = true,
        npc_dota_hero_razor = true,
        --[[npc_dota_hero_sven = true,
        npc_dota_hero_skeleton_king = true,
        npc_dota_hero_lina = true,
        npc_dota_hero_luna = true,
        npc_dota_hero_dragon_knight = true,
        npc_dota_hero_bloodseeker = true,
        npc_dota_hero_lion = true,
        npc_dota_hero_skywrath_mage = true,
        npc_dota_hero_tiny = true,
        npc_dota_hero_oracle = true,]]
    }

    -- Generate a list of possible heroes
    local possibleHeroes = {}
    for k,v in pairs(self.botHeroes) do
        if not self.bannedHeroes[k] and not brokenBots[k] then
            table.insert(possibleHeroes, k)
        end
    end

    -- Max number of slots to aim for
    local maxSlots = self.optionStore['lodOptionCommonMaxSlots']

    -- High priority bot skills
    local bestSkills = {
        abaddon_borrowed_time = true,
        ursa_fury_swipes = true,
        slark_essence_shift = true,
        skeleton_king_reincarnation = true,
        bloodseeker_thirst = true,
        slark_shadow_dance = true,
        huskar_berserkers_blood = true,
        phantom_assassin_coup_de_grace = true,
        life_stealer_feast = true,
        alchemist_goblins_greed = true,
        sniper_take_aim = true,
        troll_warlord_fervor = true,
        tiny_grow_lod = true,
        riki_permanent_invisibility = true
    }

    for playerID,botInfo in pairs(self.botPlayers.all) do
        -- Only generate a build for new bots
        if not botInfo.build then
        	-- Grab a hero
            local heroName = 'npc_dota_hero_pudge'
            if #possibleHeroes > 0 then
                heroName = table.remove(possibleHeroes, math.random(#possibleHeroes))
            end

            -- Generate build
            local build = {}
            local skillID = 1
            local defaultSkills = self.botHeroes[heroName]
            if defaultSkills then
                for k,abilityName in pairs(defaultSkills) do
                    if self.flagsInverse[abilityName] and not self.bannedAbilities[abilityName] then
                        local cat = (self.flagsInverse[abilityName] or {}).category
                        if cat and self:isSkillCategoryAllowed(cat) then
                            build[skillID] = abilityName
                            skillID = skillID + 1
                        end
                    end
                end
            end

            -- Allocate more abilities
            while skillID <= maxSlots do
                -- Attempt to pick a high priority skill, otherwise pick any passive, otherwise pick any
                local newAb = self:findRandomSkill(build, skillID, playerID, function(abilityName)
                    return bestSkills[abilityName] ~= nil
                end) or self:findRandomSkill(build, skillID, playerID, function(abilityName)
                    return SkillManager:isPassive(abilityName)
                end) or self:findRandomSkill(build, skillID, playerID)

                if newAb ~= nil then
                    build[skillID] = newAb
                end

                -- Move onto next slot
                skillID = skillID + 1
            end

            -- Shuffle their build to make it look like a random set
            for i = maxSlots, 2, -1 do
                local j = math.random (i)
                build[i], build[j] = build[j], build[i]
            end

            -- Are there any premade builds?
            if self.premadeBotBuilds then
            	if botInfo.team == DOTA_TEAM_BADGUYS and self.premadeBotBuilds.dire and #self.premadeBotBuilds.dire > 0 then
            		local info = table.remove(self.premadeBotBuilds.dire, 1)
            		build = info.build
            		heroName = info.heroName
            	end

            	if botInfo.team == DOTA_TEAM_GOODGUYS and self.premadeBotBuilds.radiant and #self.premadeBotBuilds.radiant > 0 then
            		local info = table.remove(self.premadeBotBuilds.radiant, 1)
            		build = info.build
            		heroName = info.heroName
            	end
            end

            -- Store the info
            botInfo.build = build
            botInfo.heroName = heroName

            -- Network their build
            self:setSelectedHero(playerID, heroName, true)
            self.selectedSkills[playerID] = build
            network:setSelectedAbilities(playerID, build)

            -- Bot has now locked their build
            self.lockedBuilds[playerID] = 1
        end
    end
end

-- Spawns bots
function Pregame:hookBotStuff()
    -- Ensure bots are actually enabled
    if not self.enabledBots or self.hookedBotStuff then
        self.hookedBotStuff = true
        return
    end

    -- Grab a reference to self
    local this = self

    -- Auto level bot skills (bots will get 2 ability points per level)
    ListenToGameEvent('dota_player_gained_level', function(keys)
        local playerID = keys.player - 1
        local level = keys.level

        -- Is this player a bot?
        if PlayerResource:GetConnectionState(playerID) == 1 then
            local hero = PlayerResource:GetSelectedHeroEntity(playerID)
            if IsValidEntity(hero) then
                local build = this.selectedSkills[playerID]

                local heroName = hero:GetClassname()
                local defaultSkills = {}
                for k,abilityName in pairs(this.botHeroes[heroName] or {}) do
                    defaultSkills[abilityName] = true
                end

                local lowestLevel = 25
                local lowestAb

                for k,abilityName in pairs(build) do
                    -- We are not going to touch hero default skills
                    if not defaultSkills[abilityName] then
                        local ab = hero:FindAbilityByName(abilityName)
                        if ab then
                            local abLevel = ab:GetLevel()

                            -- Has it already hit it's max level?
                            if abLevel < ab:GetMaxLevel() then
                                -- Work out what level we need to be to legally skill this ability
                                local nextUpgrade = abLevel * 2 + 1
                                if SkillManager:isUlt(abilityName) then
                                    nextUpgrade = 6 + 5 * abLevel
                                end

                                -- Can we legally skill this ability?
                                if nextUpgrade <= level then
                                    -- Is this the lowest level skill?
                                    if abLevel < lowestLevel then



                                        lowestLevel = abLevel
                                        lowestAb = ab
                                    end
                                end
                            end
                        end
                    end
                end

                -- If we failed to find any skills to skill
                --[[if lowestAb == nil then
                    -- Try to skill attribute bonus
                    lowestAb = hero:FindAbilityByName('attribute_bonus')
                    if lowestAb ~= nil then
                        lowestLevel = lowestAb:GetLevel()
                        if lowestLevel >= lowestAb:GetMaxLevel() then
                            lowestAb = nil
                        end
                    end
                end]]

                -- Apply the point
                if lowestAb ~= nil then
                    lowestAb:SetLevel(lowestLevel + 1)
                end
            end
        end
    end, nil)
end

-- Apply fixes
function Pregame:fixSpawningIssues()
    local givenBonuses = {}
    local handled = {}
    local givenCouriers = {}

    -- Grab a reference to self
    local this = self

    local notOnIllusions = {
    	lone_druid_spirit_bear = true,
    	necronomicon_warrior_last_will_lod = true
	}

    ListenToGameEvent('npc_spawned', function(keys)
        -- Grab the unit that spawned
        local spawnedUnit = EntIndexToHScript(keys.entindex)

        -- Ensure it's a valid unit
        if IsValidEntity(spawnedUnit) then
            -- Make sure it is a hero
            if spawnedUnit:IsHero() then
                -- Grab their playerID
                local playerID = spawnedUnit:GetPlayerID()

                local mainHero = PlayerResource:GetSelectedHeroEntity(playerID)

                -- Fix meepo clones and illusions
                if mainHero and mainHero ~= spawnedUnit then
                    -- Apply the build
                    local build = this.selectedSkills[playerID] or {}
                    SkillManager:ApplyBuild(spawnedUnit, build)

                    -- Do they have a custom attribute set?
                    if self.selectedPlayerAttr[playerID] ~= nil then
                        -- Set it

                        local toSet = 0

                        if self.selectedPlayerAttr[playerID] == 'str' then
                            toSet = 0
                        elseif self.selectedPlayerAttr[playerID] == 'agi' then
                            toSet = 1
                        elseif self.selectedPlayerAttr[playerID] == 'int' then
                            toSet = 2
                        end

                        -- Set a timer to fix stuff up
                        Timers:CreateTimer(function()
                            if IsValidEntity(spawnedUnit) then
                                spawnedUnit:SetPrimaryAttribute(toSet)
                            end
                        end, DoUniqueString('primaryAttrFix'), 0.1)
                    end

                    -- Illusion and Tempest Double fixes
                    if not spawnedUnit:IsClone() then
	                    Timers:CreateTimer(function()
		                    if IsValidEntity(spawnedUnit) then
		                    	for k,abilityName in pairs(build) do
		                    		if notOnIllusions[abilityName] then
		                    			local ab = spawnedUnit:FindAbilityByName(abilityName)
	                    				if ab then
	                    					ab:SetLevel(0)
	                    				end
		                    		end
		                    	end


		                    end
		                end, DoUniqueString('fixBrokenSkills'), 0)
		            end

                    -- Set the correct level for each ability
                    --[[for k,v in pairs(build) do
                        local abMain = mainHero:FindAbilityByName(v)

                        if abMain then
                            local abAlt = spawnedUnit:FindAbilityByName(v)

                            if abAlt then
                                -- Both heroes have both skills, set the level
                                abAlt:SetLevel(abMain:GetLevel())
                            end
                        end
                    end]]
                end

                -- Various fixes
                Timers:CreateTimer(function()
                    if IsValidEntity(spawnedUnit) then
                        -- Silencer Fix
                        if spawnedUnit:HasAbility('silencer_glaives_of_wisdom') then
                            if not spawnedUnit:HasModifier('modifier_silencer_int_steal') then
                                spawnedUnit:AddNewModifier(spawnedUnit, nil, 'modifier_silencer_int_steal', {})
                            end
                        else
                            spawnedUnit:RemoveModifierByName('modifier_silencer_int_steal')
                        end
                    end
                end, DoUniqueString('silencerFix'), 0.1)

                -- Don't touch this hero more than once :O
                if handled[spawnedUnit] then return end
                handled[spawnedUnit] = true

                -- Are they a bot?
                --[[if PlayerResource:GetConnectionState(playerID) == 1 then
                    -- Apply build!
                    local build = this.selectedSkills[playerID] or {}
                    SkillManager:ApplyBuild(spawnedUnit, build)
                end]]

                --[[local ab1 = spawnedUnit:GetAbilityByIndex(1)
                local ab2 = spawnedUnit:GetAbilityByIndex(2)
                local ab3 = spawnedUnit:GetAbilityByIndex(3)

                local ab1Name = ab1:GetAbilityName()
                local ab2Name = ab2:GetAbilityName()
                local ab3Name = ab3:GetAbilityName()

                print('NEW')
                print(ab1Name)
                print(ab2Name)
                print(ab3Name)]]

                --spawnedUnit:RemoveAbility(ab1Name)
                --spawnedUnit:RemoveAbility(ab2Name)
                --spawnedUnit:RemoveAbility(ab3Name)

                --[[spawnedUnit:AddAbility('pudge_meat_hook')
                spawnedUnit:AddAbility('pudge_flesh_heap')
                spawnedUnit:AddAbility('pudge_dismember')
                spawnedUnit:AddAbility('pudge_rot')]]

                -- Handle the free courier stuff
                --handleFreeCourier(spawnedUnit)

                -- Handle free scepter stuff
                if OptionManager:GetOption('freeScepter') then
                    spawnedUnit:AddNewModifier(spawnedUnit, nil, 'modifier_item_ultimate_scepter_consumed', {
                        bonus_all_stats = 0,
                        bonus_health = 0,
                        bonus_mana = 0
                    })
                end

               if OptionManager:GetOption('freeCourier') then
                    local team = spawnedUnit:GetTeam()

                    if not givenCouriers[team] then
            			Timers:CreateTimer(function()
            				if IsValidEntity(spawnedUnit) then
                                if not givenCouriers[team] then
                                    givenCouriers[team] = true
                                    local item = spawnedUnit:AddItemByName('item_courier')

                                    if item then
                                        spawnedUnit:CastAbilityImmediately(item, spawnedUnit:GetPlayerID())
                                    end
                                end
            				end
            			end, DoUniqueString('spawncourier'), 1)
                    end
                end

                -- Only give bonuses once
                if not givenBonuses[playerID] then
                    -- We have given bonuses
                    givenBonuses[playerID] = true

                    local startingLevel = OptionManager:GetOption('startingLevel')
                    -- Do we need to level up?
                    if startingLevel > 1 then
                        -- Level it up
                        --for i=1,startingLevel-1 do
                        --    spawnedUnit:HeroLevelUp(false)
                        --end

                        -- Fix EXP
                        spawnedUnit:AddExperience(constants.XP_PER_LEVEL_TABLE[startingLevel], false, false)
                    end

                    -- Any bonus gold?
                    if OptionManager:GetOption('bonusGold') > 0 then
                        PlayerResource:SetGold(playerID, OptionManager:GetOption('bonusGold'), true)
                    end
                end
            end
        end
    end, nil)
end

-- Return an instance of it
return Pregame()
