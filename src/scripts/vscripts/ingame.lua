local util = require('util')
local constants = require('constants')
local network = require('network')
local OptionManager = require('optionmanager')
local Timers = require('easytimers')
local lodVoting = require('ingame.voting')
local SkillManager = require('skillmanager')

-- Create the class for it
local Ingame = class({})

-- Init Ingame stuff, sets up all ingame related features
function Ingame:init()
    -- Init everything
    self:handleRespawnModifier()
    self:handleBuybackCooldowns()
    self:initGoldBalancer()

    -- Setup standard rules
    GameRules:GetGameModeEntity():SetTowerBackdoorProtectionEnabled(true)

    -- Precache orgre magi stuff
    PrecacheUnitByNameAsync('npc_precache_npc_dota_hero_ogre_magi', function()
        CreateUnitByName('npc_precache_npc_dota_hero_ogre_magi', Vector(-10000, -10000, 0), false, nil, nil, 0)
    end)

    -- Precache survival resources
    --[[PrecacheUnitByNameAsync('npc_precache_survival', function()
        CreateUnitByName('npc_precache_survival', Vector(-10000, -10000, 0), false, nil, nil, 0)
    end)]]

    -- Precache wraithnight stuff
    PrecacheUnitByNameAsync('npc_precache_wraithnight', function()
        CreateUnitByName('npc_precache_wraithnight', Vector(-10000, -10000, 0), false, nil, nil, 0)
    end)

    -- Precache the stuff that needs to always be precached
    PrecacheUnitByNameAsync('npc_precache_always', function()
        CreateUnitByName('npc_precache_always', Vector(-10000, -10000, 0), false, nil, nil, 0)
    end)

    -- A store for ability cooldowns
    self.abilityCooldowns = {}

    -- Set it to no team balance
    --self:setNoTeamBalanceNeeded()
end

-- Called when the game starts
function Ingame:onStart()
    local this = self

    -- Start listening for players that are disconnecting
    --[[ListenToGameEvent('player_disconnect', function(keys)
        this:checkBalanceTeamsNextTick()
    end, nil)

    -- Listen for players connecting
    ListenToGameEvent('player_connect', function(keys)
        this:checkBalanceTeamsNextTick()
    end, nil)

    ListenToGameEvent('player_connect_full', function(keys)
        this:checkBalanceTeamsNextTick()
    end, nil)]]

    -- Init voting system
    lodVoting:init()
end

-- Balances a player onto another team
function Ingame:balancePlayer(playerID, newTeam)
    -- Balance the player
    PlayerResource:SetCustomTeamAssignment(playerID, newTeam)

    -- Balance their hero
    local hero = PlayerResource:GetSelectedHeroEntity(playerID)
    if IsValidEntity(hero) then
        -- Change the team
        hero:SetTeam(newTeam)

        -- Kill the hero
        hero:Kill(nil, nil)

        -- Respawn after 1.11 seconds
        Timers:CreateTimer(function()
            -- Ensure the hero is still valid
            if IsValidEntity(hero) then
                -- Set the time left until we respawn
                hero:SetTimeUntilRespawn(1)

                -- Check if we have any meepo clones
                if hero:HasAbility('meepo_divided_we_stand') then
                    local clones = Entities:FindAllByName(hero:GetClassname())

                    for k,meepoClone in pairs(clones) do
                        if meepoClone:IsClone() and playerID == meepoClone:GetPlayerID() then
                            meepoClone:SetTimeUntilRespawn(1)
                        end
                    end
                end
            end
        end, DoUniqueString('respawn'), 0.11)
    end
end

-- Balances the EXP of all players
function Ingame:balanceEXP()
    local highestLevel = 1
    local maxPlayers = 24
    for playerID=0,maxPlayers-1 do
        local level = PlayerResource:GetLevel(playerID)
        if level > highestLevel then
            highestLevel = level
        end
    end

    -- Loop over each player
    for playerID=0,maxPlayers-1 do
        local level = PlayerResource:GetLevel(playerID)
        if level < highestLevel then
            local hero = PlayerResource:GetSelectedHeroEntity(playerID)
            if IsValidEntity(hero) then
                -- How much EXP do we need to add to level them to the highest player's level?
                local exp = constants.XP_PER_LEVEL_TABLE[highestLevel] - constants.XP_PER_LEVEL_TABLE[level]

                -- ADd the experience
                hero:AddExperience(exp, false, false)
            end
        end
    end
end

--[[-- Sets it to no team balancing is required
function Ingame:setNoTeamBalanceNeeded()
    -- Store state informatiion about team balance
    self.needsTeamBalance = false

    -- Network it
    network:setTeamBalanceData({
        required = false
    })
end

-- Sets balance info
function Ingame:setTeamBalanceInfo(info)
    info = info or {}
    self.radiantPlayers = info.radiantPlayers or self.radiantPlayers or 0
    self.direPlayers = info.direPlayers or self.direPlayers or 0
    self.takeFromTeam = info.takeFromTeam or self.takeFromTeam or 0

    -- Do some minor validation
    if self.takeFromTeam ~= DOTA_TEAM_GOODGUYS and self.takeFromTeam ~= DOTA_TEAM_BADGUYS then
        self:setNoTeamBalanceNeeded()
        return
    end

    -- Store state
    self.needsTeamBalance = true

    -- Network it
    network:setTeamBalanceData({
        required = true,
        takeFromTeam = self.takeFromTeam
    })

    print('balancing = '..self.takeFromTeam)
end

-- Checks balance stuff in the next tick
function Ingame:checkBalanceTeamsNextTick()
    local this = self

    -- Give a small delay then check for team balancing
    Timers:CreateTimer(function()
        this:checkBalanceTeams()
    end, DoUniqueString('balanceChecker'), 0)
end

-- Called to check if teams need to be balanced
function Ingame:checkBalanceTeams()
    local maxPlayers = 24

    local radiantPlayers = 0
    local direPlayers = 0

    for playerID = 0,(maxPlayers-1) do
        local state = PlayerResource:GetConnectionState(playerID)

        if state == 1 or state == 2 then
            local team = PlayerResource:GetCustomTeamAssignment(playerID)

            if team == DOTA_TEAM_GOODGUYS then
                radiantPlayers = radiantPlayers + 1
            elseif team == DOTA_TEAM_BADGUYS then
                direPlayers = direPlayers + 1
            end
        end
    end

    -- Can balancing occur?
    if math.abs(radiantPlayers - direPlayers) > 1 then
        -- Decide which team to take players from
        local takeFromTeam = DOTA_TEAM_GOODGUYS
        if radiantPlayers < direPlayers then
            takeFromTeam = DOTA_TEAM_BADGUYS
        end

        -- Store balance info
        self:setTeamBalanceInfo({
            radiantPlayers = radiantPlayers,
            direPlayers = direPlayers,
            takeFromTeam = takeFromTeam
        })
    else
        -- Can't balance
        self:setNoTeamBalanceNeeded()
    end
end]]

-- Buyback cooldowns
function Ingame:handleBuybackCooldowns()
    ListenToGameEvent('npc_spawned', function(keys)
        local hero = EntIndexToHScript(keys.entindex)

        if IsValidEntity(hero) then
            if hero:IsHero() then
                Timers:CreateTimer(function()
                    if IsValidEntity(hero) then
                        local buyBackLeft = hero:GetBuybackCooldownTime()

                        if buyBackLeft ~= 0 then
                            local maxCooldown = OptionManager:GetOption('buybackCooldown')

                            if buyBackLeft > maxCooldown then
                                hero:SetBuybackCooldownTime(maxCooldown)
                            end
                        end
                    end
                end, DoUniqueString('buyback'), 0.1)
            end
        end
    end, nil)
end

-- Respawn modifier
function Ingame:handleRespawnModifier()
    ListenToGameEvent('entity_killed', function(keys)
        -- Ensure our respawn modifier is in effect
        local respawnModifierPercentage = OptionManager:GetOption('respawnModifierPercentage')
        local respawnModifierConstant = OptionManager:GetOption('respawnModifierConstant')
        if respawnModifierPercentage == 100 and respawnModifierConstant == 0 then return end

        -- Grab the killed entitiy (it isn't nessessarily a hero!)
        local hero = EntIndexToHScript(keys.entindex_killed)

        -- Ensure it is a hero
        if IsValidEntity(hero) then
            if hero:IsHero() then
                -- Ensure we are not using aegis!
                if hero:WillReincarnate() then return end
                if hero:IsReincarnating() then return end
                if hero:HasItemInInventory('item_aegis') then return end

                -- Only apply respawn modifiers to the main hero
                local playerID = hero:GetPlayerID()
                local mainHero = PlayerResource:GetSelectedHeroEntity(playerID)
                if hero == mainHero then
                    Timers:CreateTimer(function()
                        if IsValidEntity(hero) and not hero:IsAlive() then
                            -- Ensure we are not using aegis!
                            if hero:WillReincarnate() then return end
                            if hero:IsReincarnating() then return end
                            if hero:HasItemInInventory('item_aegis') then return end

                            local timeLeft = hero:GetRespawnTime()

                            timeLeft = timeLeft * respawnModifierPercentage / 100 + respawnModifierConstant

                            if timeLeft <= 0 then
                                timeLeft = 1
                            end

                            --[[if respawnModifier < 0 then
                                timeLeft = -respawnModifier
                            else
                                timeLeft = timeLeft / respawnModifier
                            end]]

                            -- Set the time left until we respawn
                            hero:SetTimeUntilRespawn(timeLeft)

                            -- Check if we have any meepo clones
                            if hero:HasAbility('meepo_divided_we_stand') then
                                local clones = Entities:FindAllByName(hero:GetClassname())

                                for k,meepoClone in pairs(clones) do
                                    if meepoClone:IsClone() and playerID == meepoClone:GetPlayerID() then
                                        meepoClone:SetTimeUntilRespawn(timeLeft)
                                    end
                                end
                            end
                        end
                    end, DoUniqueString('respawn'), 0.1)
                end
            end
        end
    end, nil)
end

-- Init gold balancer
function Ingame:initGoldBalancer()
    -- recalculate player team counts
    self:recalculatePlayerCounts()

    -- Filter event
    GameRules:GetGameModeEntity():SetModifyGoldFilter(Dynamic_Wrap(Ingame, "FilterModifyGold" ), self)
    GameRules:GetGameModeEntity():SetModifyExperienceFilter(Dynamic_Wrap(Ingame, "FilterModifyExperience" ), self)

    local this = self

    -- Hook recalculations
    ListenToGameEvent('player_connect', function(keys)
        GameRules:GetGameModeEntity():SetThink(function()
            -- Recalculate the counts
            this:recalculatePlayerCounts()
        end, 'calcPlayerTotals', 1, nil)
    end, nil)

    ListenToGameEvent('player_connect_full', function(keys)
        GameRules:GetGameModeEntity():SetThink(function()
            -- Recalculate the counts
            this:recalculatePlayerCounts()
        end, 'calcPlayerTotals', 1, nil)
    end, nil)

    ListenToGameEvent('player_disconnect', function(keys)
        GameRules:GetGameModeEntity():SetThink(function()
            -- Recalculate the counts
            this:recalculatePlayerCounts()
        end, 'calcPlayerTotals', 1, nil)
    end, nil)

    ListenToGameEvent('game_rules_state_change', function(keys)
        GameRules:GetGameModeEntity():SetThink(function()
            -- Recalculate the counts
            this:recalculatePlayerCounts()
        end, 'calcPlayerTotals', 1, nil)
    end, nil)
end

-- Counts how many players on each team
function Ingame:recalculatePlayerCounts()
    local this = self

    if not pcall(function()
        -- Default to no players
        this.playersOnTeam = {
            radiant = 0,
            dire = 0
        }

        -- Work it out
        for i=0,9 do
            local connectionState = PlayerResource:GetConnectionState(i)
            if connectionState == 1 or connectionState == 2 then
                local teamID = PlayerResource:GetTeam(i)

                if teamID == DOTA_TEAM_GOODGUYS then
                    this.playersOnTeam.radiant = this.playersOnTeam.radiant + 1
                elseif teamID == DOTA_TEAM_BADGUYS then
                    this.playersOnTeam.dire = this.playersOnTeam.dire + 1
                end
            end
        end

        -- Ensure never less than one
        for k,v in pairs(this.playersOnTeam) do
            if v <= 0 then
                this.playersOnTeam[k] = 1
            end
        end
    end) then
        this.playersOnTeam = {
            radiant = 1,
            dire = 1
        }
    end
end

-- Attempt to balance gold
function Ingame:FilterModifyGold(filterTable)
    -- Grab useful information
    local playerID = filterTable.player_id_const
    local teamID = PlayerResource:GetTeam(playerID)

    local myTeam = 1
    local enemyTeam = 1

    if teamID == DOTA_TEAM_GOODGUYS then
        myTeam = self.playersOnTeam.radiant
        enemyTeam = self.playersOnTeam.dire
    elseif teamID == DOTA_TEAM_BADGUYS then
        myTeam = self.playersOnTeam.dire
        enemyTeam = self.playersOnTeam.radiant
    end

    -- Grab the gold modifier
    local goldModifier = OptionManager:GetOption('goldModifier')

    if goldModifier ~= 1 then
        filterTable.gold = math.ceil(filterTable.gold * goldModifier / 100)
    end

    -- Slow down the gold intake for the team with more players
    local ratio = enemyTeam / myTeam
    if ratio < 1 then
        ratio = 1 - (1 - ratio) / 2

        filterTable.gold = math.ceil(filterTable.gold * ratio)
    end

    return true
end

-- Option to modify EXP
function Ingame:FilterModifyExperience(filterTable)
    local expModifier = OptionManager:GetOption('expModifier')

    if expModifier ~= 1 then
        filterTable.experience = math.ceil(filterTable.experience * expModifier / 100)
    end

    return true
end

-- Respawns a hero, with their new build
function Ingame:spawnUpdatedBuild(playerID)
    local hero = PlayerResource:GetSelectedHeroEntity(playerID)
    if IsValidEntity(hero) then
        local playerID = hero:GetPlayerID()
        self.spawningNewBuild = self.spawningNewBuild or {}
        if self.spawningNewBuild[playerID] then return end

        local newBuild = GameRules.pregame.selectedSkills[playerID]
        local newHeroName = GameRules.pregame.selectedHeroes[playerID]

        -- These should always be defined, just stop if they are not
        if not newBuild or not newHeroName then return end

        -- Update the hero
        newBuild.hero = newHeroName
        newBuild.setAttr = GameRules.pregame.selectedPlayerAttr[playerID]

        self.spawningNewBuild[playerID] = true
        PrecacheUnitByNameAsync(newHeroName, function()
            if IsValidEntity(hero) then
                SkillManager:ApplyBuild(hero, newBuild)
            end
            self.spawningNewBuild[playerID] = false
        end, playerID)
    end
end

-- Return an instance of it
return Ingame()