-- Imports
local constants = require('constants')
local notifications = require('ingame.notifications')
local Timers = require('easytimers')
local network = require('network')
local OptionManager = require('optionmanager')

-- Options
local maxVoteDuration = 30			-- How long a vote lasts for
local voteShowTimeAfterFinished = 5 -- How long to show the vote for after the vote finishes
local voteCooldownDelay = 8         -- How long before another vote can be created after a vote passes / fails
local failedVoteWaitPeriod = 120	-- How long a player has to wait if their current vote fails

-- Define the clas
local lodVoting = class({})

-- Init function
function lodVoting:init()
	-- Setup stores
	self.activeVote = false	-- Is there an active vote already?
	self.lastVotes = {}		-- The last times someone created an unsuccessful vote (stops spamming)
	self.totalVotes = 0		-- Stores the total number of votes that have been created

	-- Add network hooks
	self:addNetworkHooks()
end

-- Adds the network hooks
function lodVoting:addNetworkHooks()
	local this = self

	-- Creating a vote
	CustomGameEventManager:RegisterListener('lodVoteCreate', function(eventSourceIndex, args)
        this:onPlyVoteCreate(eventSourceIndex, args)
    end)

    -- Casting a vote
    CustomGameEventManager:RegisterListener('lodVoteCastVote', function(eventSourceIndex, args)
        this:onPlyVoteCast(eventSourceIndex, args)
    end)
end

-- Called when a player tries to create a vote
function lodVoting:onPlyVoteCreate(eventSourceIndex, args)
    -- Grab data
    local playerID = args.PlayerID
    local ply = PlayerResource:GetPlayer(playerID)

    -- Set the vote counting mode
    local voteMode = OptionManager:GetOption('votingMode')
    if voteMode == 0 then
        -- Tell the player it is disabled
        notifications:send(ply, {
            sort = 'lodDanger',
            text = 'votingErrorVotingDisabled'
        })
        return
    end

    -- Is there an active vote already?
    if self.activeVote then
    	-- Tell the player
    	notifications:send(ply, {
    		sort = 'lodDanger',
    		text = 'votingErrorVoteInProgress'
    	})
    	return
    end

    -- Are we still waiting for a cooldown on votes?
    if self.voteCooldown then
        local cooldownLeft = self.voteCooldown - Time()

        if cooldownLeft > 0 then
            -- Tell the player
            notifications:send(ply, {
                sort = 'lodDanger',
                text = 'votingErrorCooldown',
                params = {
                    ['cooldownLeft'] = math.ceil(cooldownLeft)
                }
            })
            return
        end
    end

    -- Ensure the player has waited long enough before making another vote
    if self.lastVotes[playerID] then
    	local timeLeft = self.lastVotes[playerID] + failedVoteWaitPeriod - Time()

    	if timeLeft > 0  then
    		-- Tell the player
	    	notifications:send(ply, {
	    		sort = 'lodDanger',
	    		text = 'votingErrorVoteFailedVote',
	    		params = {
	            	['timeLeft'] = math.ceil(timeLeft)
	        	}
	    	})
	    	return
    	end
    end

    -- Pull the stuff
    local voteInfo = args.info or {}
    local voteData = args.data or {}

    local voteTitle = voteInfo.title

    -- Validate that options are correct and build vote structure
    local theVote = {
    	voteTitle = voteTitle,
    	voteDuration = maxVoteDuration,
    	endTime = Time() + maxVoteDuration,
    	playerID = playerID,
    	voteMode = voteMode
	}

	-- Check vote info
	local res = self:checkVoteOptions(theVote, voteInfo, voteData)
	if res then
		-- Tell the player
    	notifications:send(ply, {
    		sort = 'lodDanger',
    		text = 'votingErrorVoteInvalid',
    		params = {
    			['error'] = res
    		}
    	})
    	return
	end

	-- Vote must be valid, try to create it
	self:createVote(theVote)

    -- Vote was successfully created
    notifications:send(ply, {
		sort = 'lodSuccess',
		text = 'votingMessageVoteCreated'
	})
end

-- Checks if a given vote is valid
function lodVoting:checkVoteOptions(theVote, voteInfo, voteData)
	-- Grab the players team
	local playerID = theVote.playerID
	local plyTeam = PlayerResource:GetCustomTeamAssignment(playerID)

	local this = self

	local votingPrepare = {
		--[[
			CHANGING OPTIONS
		]]

		votingOptionsRespawnTime = function()
			-- Ensure we are in a match
			if GameRules:State_Get() < DOTA_GAMERULES_STATE_PRE_GAME then return 'voteErrorNotInMatch' end

			local percentage = voteData.percentage
			local constant = voteData.constant

			if type(percentage) ~= 'number' then return 'voteErrorInvalidData' end
			if math.floor(percentage) ~= percentage then return 'voteErrorInvalidData' end
            if percentage < 0 or percentage > 100 then return 'voteErrorInvalidData' end

            if type(constant) ~= 'number' then return 'voteErrorInvalidData' end
			if math.floor(constant) ~= constant then return 'voteErrorInvalidData' end
            if constant < 0 or constant > 120 then return 'voteErrorInvalidData' end

            -- Add description
            theVote.voteDes = 'votingOptionsRespawnTimeDesArgs'
            theVote.voteDesArgs = {
            	percentage = percentage,
            	constant = constant
        	}

            -- Callback
            theVote.callback = function()
            	-- Adjust the respawn times
            	OptionManager:SetOption('respawnModifierPercentage', percentage)
	    		OptionManager:SetOption('respawnModifierConstant', constant)

	    		-- Update options
            	GameRules.pregame:updateOption('lodOptionGameSpeedRespawnTimePercentage', percentage)
            	GameRules.pregame:updateOption('lodOptionGameSpeedRespawnTimeConstant', constant)
        	end
		end,

		votingOptionsGoldTickRate = function()
			-- Ensure we are in a match
			if GameRules:State_Get() < DOTA_GAMERULES_STATE_PRE_GAME then return 'voteErrorNotInMatch' end

			-- Ensure we have some valid vote data
			local amount = voteData.amount

			if type(amount) ~= 'number' then return 'voteErrorInvalidData' end
			if math.floor(amount) ~= amount then return 'voteErrorInvalidData' end
            if amount < 0 or amount > 25 then return 'voteErrorInvalidData' end

            -- Add the description
            theVote.voteDes = 'votingOptionsGoldTickRateAmountDesArgs'
            theVote.voteDesArgs = {
            	amount = amount
        	}

            -- Callback
            theVote.callback = function()
            	-- Change the tick rate
            	GameRules:SetGoldPerTick(amount)

            	-- Update options
            	GameRules.pregame:updateOption('lodOptionGameSpeedGoldTickRate', amount)
        	end
		end,

		votingOptionsModifiers = function()
			-- Ensure we are in a match
			if GameRules:State_Get() < DOTA_GAMERULES_STATE_PRE_GAME then return 'voteErrorNotInMatch' end

			local gold = voteData.gold
			local xp = voteData.xp

			if type(gold) ~= 'number' then return 'voteErrorInvalidData' end
			if math.floor(gold) ~= gold then return 'voteErrorInvalidData' end
            if gold < 0 or gold > 1000 then return 'voteErrorInvalidData' end

            if type(xp) ~= 'number' then return 'voteErrorInvalidData' end
			if math.floor(xp) ~= xp then return 'voteErrorInvalidData' end
            if xp < 0 or xp > 1000 then return 'voteErrorInvalidData' end

            -- Add description
            theVote.voteDes = 'votingOptionsModifiersAmountDesArgs'
            theVote.voteDesArgs = {
            	gold = gold,
            	xp = xp
        	}

            -- Callback
            theVote.callback = function()
            	-- Adjust the respawn times
            	OptionManager:SetOption('goldModifier', gold)
			    OptionManager:SetOption('expModifier', xp)

	    		-- Update options
            	GameRules.pregame:updateOption('lodOptionGameSpeedGoldModifier', gold)
            	GameRules.pregame:updateOption('lodOptionGameSpeedEXPModifier', xp)
        	end
		end,

		votingOptionsBuybackCooldown = function()
			-- Ensure we are in a match
			if GameRules:State_Get() < DOTA_GAMERULES_STATE_PRE_GAME then return 'voteErrorNotInMatch' end

			-- Ensure we have some valid vote data
			local amount = voteData.amount

			if type(amount) ~= 'number' then return 'voteErrorInvalidData' end
			if math.floor(amount) ~= amount then return 'voteErrorInvalidData' end
            if amount < 0 or amount > 7 * 60 then return 'voteErrorInvalidData' end

            -- Add the description
            theVote.voteDes = 'votingOptionsBuybackCooldownAmountDesArgs'
            theVote.voteDesArgs = {
            	amount = amount
        	}

            -- Callback
            theVote.callback = function()
            	-- Change the cooldown
            	OptionManager:SetOption('buybackCooldown', amount)

            	-- Update options
            	GameRules.pregame:updateOption('lodOptionGameSpeedBuybackCooldown', amount)
        	end
		end,

        votingOptionsAllVision = function()
            -- Ensure we are in a match
            if GameRules:State_Get() < DOTA_GAMERULES_STATE_PRE_GAME then return 'voteErrorNotInMatch' end

            -- Ensure we have some valid vote data
            local enabled = voteData.enabled

            if type(enabled) ~= 'number' then return 'voteErrorInvalidData' end
            if enabled ~= 1 and enabled ~= 0 then return 'voteErrorInvalidData' end

            if enabled then
                theVote.voteDes = 'votingOptionsAllVisionDesEnable'
            else
                theVote.voteDes = 'votingOptionsAllVisionDesDisable'
            end

            -- Vote won't do anything
            if GameRules.pregame.optionStore['lodOptionCrazyAllVision'] == enabled then
                if enabled then
                    return 'votingOptionsAllVisionAlreadyEnabled'
                else
                    return 'votingOptionsAllVisionAlreadyDisabled'
                end
            end

            -- No args
            theVote.voteDesArgs = {}

            -- Callback
            theVote.callback = function()
                -- Change all vision
                Convars:SetBool('dota_all_vision', enabled == 1)

                -- Update options
                GameRules.pregame:updateOption('lodOptionCrazyAllVision', enabled)
            end
        end,

		--[[
			GAMEPLAY
		]]

		votingGameplayAddGold = function()
			-- Ensure we are in a match
			if GameRules:State_Get() < DOTA_GAMERULES_STATE_PRE_GAME then return 'voteErrorNotInMatch' end

			-- Ensure we have some valid vote data
			local amount = voteData.amount

			if type(amount) ~= 'number' then return 'voteErrorInvalidData' end
			if math.floor(amount) ~= amount then return 'voteErrorInvalidData' end
            if amount < 1 or amount > 5000 then return 'voteErrorInvalidData' end

            -- Add the description
            theVote.voteDes = 'votingGameplayAddGoldDesArgs'
            theVote.voteDesArgs = {
            	amount = amount
        	}

            -- Callback
            theVote.callback = function()
            	-- Allocate the extra gold
            	local maxPlayers = 24
            	for i=0,maxPlayers-1 do
            		PlayerResource:SetGold(i, PlayerResource:GetReliableGold(i) + amount, true)
            	end
        	end
		end,

		votingGameplayAddXP = function()
			-- Ensure we are in a match
			if GameRules:State_Get() < DOTA_GAMERULES_STATE_PRE_GAME then return 'voteErrorNotInMatch' end

			-- Ensure we have some valid vote data
			local amount = voteData.amount

			if type(amount) ~= 'number' then return 'voteErrorInvalidData' end
			if math.floor(amount) ~= amount then return 'voteErrorInvalidData' end
            if amount < 1 or amount > 5000 then return 'voteErrorInvalidData' end

            -- Add the description
            theVote.voteDes = 'votingGameplayAddXPDesArgs'
            theVote.voteDesArgs = {
            	amount = amount
        	}

            -- Callback
            theVote.callback = function()
            	-- Allocate the extra gold
            	local maxPlayers = 24
            	for i=0,maxPlayers-1 do
            		local hero = PlayerResource:GetSelectedHeroEntity(i)

            		if IsValidEntity(hero) then
            			hero:AddExperience(amount, false, false)
            		end
            	end
        	end
		end,

		--[[
			BALANCE TEAMS
		]]

		-- Swapping yourself onto another team
		votingBalanceAddBots = function()
			-- Ensure we are in a match
			if GameRules:State_Get() < DOTA_GAMERULES_STATE_PRE_GAME then return 'voteErrorNotInMatch' end

			-- Ensure we have some valid vote data
			local radiantBots = voteData.radiant
			local direBots = voteData.dire

			if type(radiantBots) ~= 'number' then return 'voteErrorInvalidData' end
			if math.floor(radiantBots) ~= radiantBots then return 'voteErrorInvalidData' end
            if radiantBots < 0 or radiantBots > 10 then return 'voteErrorInvalidData' end

            if type(direBots) ~= 'number' then return 'voteErrorInvalidData' end
			if math.floor(direBots) ~= direBots then return 'voteErrorInvalidData' end
            if direBots < 0 or direBots > 10 then return 'voteErrorInvalidData' end

            -- Ensure they want to add some bots
            if direBots == 0 and radiantBots == 0 then
            	return 'voteErrorInvalidData'
            end

            local totalRadiant = 0
            local totalDire = 0

			local maxPlayers = 24
			for i=0,maxPlayers-1 do
				local state = PlayerResource:GetConnectionState(i)

				-- Are they are bot, or a CONNECTED player?
				if state == 1 or state == 2 then
					local theirTeam = PlayerResource:GetCustomTeamAssignment(i)

					if theirTeam == DOTA_TEAM_BADGUYS then
						totalDire = totalDire + 1
					elseif theirTeam == DOTA_TEAM_GOODGUYS then
						totalRadiant = totalRadiant + 1
					end
				end
			end

			if radiantBots > 0 and totalRadiant + radiantBots > 10 then
				return 'voteErrorNoPlayerSlots'
			end

			if direBots > 0 and totalDire + direBots > 10 then
				return 'voteErrorNoPlayerSlots'
			end

			theVote.voteDes = 'votingBalanceAddBotsDesArgs'

			theVote.voteDesArgs = {
				radiant = radiantBots,
				dire = direBots
			}

			theVote.callback = function()
				-- Add bots
				local allNew = GameRules.pregame:addBots(DOTA_TEAM_GOODGUYS, radiantBots)
				local newDire = GameRules.pregame:addBots(DOTA_TEAM_BADGUYS, direBots)

				for k,v in pairs(newDire) do
					table.insert(allNew, v)
				end

				-- Generate their builds
				GameRules.pregame:generateBotBuilds()

				-- Work out how much EXP is needed to get the bot to the level of the highest player in the match
				local addEXP = 0
				local addGold = 0
				local maxPlayers = 24
				for playerID=0,maxPlayers-1 do
					local level = PlayerResource:GetLevel(playerID)
					if level > 1 then
						local expNeeded = constants.XP_PER_LEVEL_TABLE[level]

						if expNeeded and expNeeded > addEXP then
							addEXP = expNeeded
						end
					end

					local gpm = PlayerResource:GetGoldPerMin(playerID)
					if gpm and gpm > 0 and gpm > addGold then
						gpm = addGold
					end
				end

				-- Multiply by time to get total gold
				addGold = addGold * Time() / 60

				-- Spawn the bots
				for _,playerID in pairs(allNew) do
					GameRules.pregame:spawnPlayer(playerID)

					this:addDelayedGoldExp(playerID, addGold, addEXP)
				end
			end
		end,

		-- Adding bots
		votingBalanceTeamsSwapSelf = function()
            -- Ensure we are in a match
            if GameRules:State_Get() < DOTA_GAMERULES_STATE_PRE_GAME then return 'voteErrorNotInMatch' end

            -- Check number of players on other team
            local enemyTeam = DOTA_TEAM_BADGUYS
            if plyTeam == DOTA_TEAM_BADGUYS then
                enemyTeam = DOTA_TEAM_GOODGUYS
            end

            local totalEnemies = 0
            local maxPlayers = 24
            for i=0,maxPlayers-1 do
                local state = PlayerResource:GetConnectionState(i)

                -- Are they are bot, or a CONNECTED player?
                if state == 1 or state == 2 then
                    if PlayerResource:GetCustomTeamAssignment(i) == enemyTeam then
                        totalEnemies = totalEnemies + 1
                    end
                end
            end

            if totalEnemies >= DOTA_MAX_TEAM_PLAYERS then
                return 'voteErrorNoPlayerSlots'
            end

            theVote.voteDes = 'votingBalanceTeamsSwapSelfDesArgs'

            theVote.voteDesArgs = {
                plyName = PlayerResource:GetPlayerName(playerID)
            }

            theVote.callback = function()
                GameRules.ingame:balancePlayer(playerID, enemyTeam)
            end
        end,

        -- Catching people up, level wise
        votingBalanceTeamsLevelHeroes = function()
			-- Ensure we are in a match
			if GameRules:State_Get() < DOTA_GAMERULES_STATE_PRE_GAME then return 'voteErrorNotInMatch' end

			theVote.voteDes = 'votingBalanceTeamsLevelHeroesDes'
			theVote.voteDesArgs = {}

			theVote.callback = function()
				GameRules.ingame:balanceEXP()
			end
		end,

		--[[
			GIVING UP
		]]

		-- Calling GG
		votingGiveupCallGG = function()
			-- Are we pregame?
			if GameRules:State_Get() < DOTA_GAMERULES_STATE_GAME_IN_PROGRESS then
				return 'voteErrorPregame'
			end

			-- Team only vote
			theVote.team = plyTeam

			-- Add the description
			theVote.voteDes = 'votingGiveupCallGGDes'

			-- Callback
			theVote.callback = function()
				-- Call GG
				this:callGG(theVote.team)
			end
		end,

		-- Calling a draw
		votingGiveupCallDraw = function()
			-- Are we pregame?
			if GameRules:State_Get() < DOTA_GAMERULES_STATE_GAME_IN_PROGRESS then
				return 'voteErrorPregame'
			end

			-- Add the description
			theVote.voteDes = 'votingGiveupCallDrawDes'

			-- Callback
			theVote.callback = function()
				-- Call GG
				GameRules:SetGameWinner(0)
			end
		end
	}

	-- Ensure it is has a callback
	if not votingPrepare[theVote.voteTitle] then
		return 'voteErrorUnknownVote'
	end

	-- Prepare the vote
	local res = votingPrepare[theVote.voteTitle]()
	if res then
		return res
	end
end

-- Creates a new vote
function lodVoting:createVote(activeVoteInfo)
	-- Ensure there isn't already an active vote
	if self.activeVote then return end

	local this = self

	-- Create a new voteID for this vote
	self.totalVotes = self.totalVotes + 1
	local voteID = self.totalVotes
	activeVoteInfo.voteID = voteID

	-- There is now an active vote
	self.activeVote = true

	-- Reset who has voted
	activeVoteInfo.plyVotes = {}
	activeVoteInfo.totalYes = 0
	activeVoteInfo.totalNo = 0

	-- Store the active vote info
	self.activeVoteInfo = activeVoteInfo

	-- Create a timer to check the status of this vote
	Timers:CreateTimer(function()
		-- Checks the progress of a vote
        this:checkVoteProgress(voteID)
    end, DoUniqueString('createVote'), activeVoteInfo.voteDuration)

    -- Casts our vote
    self.activeVoteInfo.plyVotes[self.activeVoteInfo.playerID] = true
    self.activeVoteInfo.totalYes = self.activeVoteInfo.totalYes + 1

    -- Check the progress of the vote
    self:checkVoteProgress()
end

-- Checks how many active players there are
function lodVoting:getVotesRequired()
    -- How many people are playing?
    local totalPeople = 0
    for i=0,24 do
        if PlayerResource:GetConnectionState(i) == 2 then
            totalPeople = totalPeople + 1
        end
    end

    -- Grab the total number of votes so far
    local totalVotesSoFar = self.activeVoteInfo.totalYes + self.activeVoteInfo.totalNo

    -- Work out how many votes are needed for this thing to pass
    local votesRequiredIfEveryoneVotes = totalPeople
    local votesRequiredToPass = totalVotesSoFar
    if self.activeVoteInfo.voteMode == constants.VOTE_COUNT_MODE_FAIR then
        votesRequiredIfEveryoneVotes = math.ceil(totalPeople * 0.5 + 1)

        if votesRequiredIfEveryoneVotes > totalPeople then
            votesRequiredIfEveryoneVotes = totalPeople
        end

        votesRequiredToPass = math.ceil(totalVotesSoFar * 0.5 + 1)
        if votesRequiredToPass > totalVotesSoFar then
            votesRequiredToPass = totalVotesSoFar
        end
    elseif self.activeVoteInfo.voteMode == constants.VOTE_COUNT_MODE_EVERYONE then
        votesRequiredIfEveryoneVotes = totalPeople
        votesRequiredToPass = totalVotesSoFar
    end

    -- Work out how many "no" votes are needed for this vote to fail
    local votesForFail = totalPeople - votesRequiredIfEveryoneVotes + 1

    -- Return the info
    return totalPeople, votesRequiredToPass, votesForFail
end

-- Checks the progress of a vote
function lodVoting:checkVoteProgress(voteID)
	-- Is this a relevant check?
	if not self.activeVote or not self.activeVoteInfo or (voteID ~= nil and self.activeVoteInfo.voteID ~= voteID) then
		-- Not valid, break
		return
	end

    -- How many people are playing? How many votes do we need to pass it?
    local totalPeople, votesRequired, votesForFail = self:getVotesRequired()

	-- Check votes and percentages for early vote kill
	if self.activeVoteInfo.totalNo >= votesForFail then
		-- Got too many no, end it
		self:endVote()
		return
	end

	-- Has everyone voted?
	if self.activeVoteInfo.totalYes + self.activeVoteInfo.totalNo >= totalPeople then
		-- Everyone has voted
		self:endVote()
		return
	end

	-- Is the vote over?
	if voteID ~= nil then
		self:endVote()
		return
	end

	-- Update networking
	network:updateVoteInfo(self.activeVoteInfo)
end

-- end the vote
function lodVoting:endVote()
	if not self.activeVote then return end
	if not self.activeVoteInfo then return end

	-- Vote is over, end it
	self.activeVote = false

	-- Calculate the winner
	local passed = true

	-- No yeses?
	if self.activeVoteInfo.totalYes == 0 then
		passed = false
	end

    -- How many people are playing? How many votes do we need to pass it?
    local totalPeople, votesRequired, votesForFail = self:getVotesRequired()

	-- Too many nos?
	if self.activeVoteInfo.totalNo >= votesForFail then
		passed = false
	end

    -- Not enough yes?
    if self.activeVoteInfo.totalYes < votesRequired then
        passed = false
    end

	-- Update it
	self.activeVoteInfo.finished = true
	self.activeVoteInfo.hideTime = Time() + voteShowTimeAfterFinished
	self.activeVoteInfo.passed = passed
	network:updateVoteInfo(self.activeVoteInfo)

    -- Add a cooldown to stop another vote from instantly being created
    self.voteCooldown = Time() + voteCooldownDelay

	-- Did the vote pass?
	if passed then
		-- Run a callback if one exists
		local callback = self.activeVoteInfo.callback
		if callback then
			callback(self.activeVoteInfo)
		end
	else
		-- Stop the player from making another vote anytime soon
		self.lastVotes[self.activeVoteInfo.playerID] = Time()
	end
end

-- Called when a player tries to cast a vote
function lodVoting:onPlyVoteCast(eventSourceIndex, args)
	-- Grab data
    local playerID = args.PlayerID
    local ply = PlayerResource:GetPlayer(playerID)

    -- Is there an active vote?
    if not self.activeVote then return end
    if not self.activeVoteInfo then return end

    -- Has this player already cast their vote?
    if self.activeVoteInfo.plyVotes[playerID] then return end

    -- Is this a team vote?
    if self.activeVoteInfo.team ~= nil then
    	-- Check the team
    	if PlayerResource:GetCustomTeamAssignment(playerID) ~= self.activeVoteInfo.team then return end
    end

    -- This player has now cast their vote
    self.activeVoteInfo.plyVotes[playerID] = true

    -- Add to the totals
    if args.vote == 'yes' then
    	self.activeVoteInfo.totalYes = self.activeVoteInfo.totalYes + 1
    else
    	self.activeVoteInfo.totalNo = self.activeVoteInfo.totalNo + 1
    end

    -- Check if we can kill it
    self:checkVoteProgress()
end

-- Call GG
function lodVoting:callGG(losingTeam)
	if losingTeam == DOTA_TEAM_BADGUYS then
		GameRules:SetGameWinner(DOTA_TEAM_GOODGUYS)
	elseif losingTeam == DOTA_TEAM_GOODGUYS then
		GameRules:SetGameWinner(DOTA_TEAM_BADGUYS)
	end
end

-- Adds gold and EXP to a player after a short delay
function lodVoting:addDelayedGoldExp(playerID, gold, exp)
	local this = self

	Timers:CreateTimer(function()
		-- Grab the hero and add EXP
		local hero = PlayerResource:GetSelectedHeroEntity(playerID)
		if IsValidEntity(hero) then
			-- Add Exp
			hero:AddExperience(exp, false, false)

			-- Add Gold
			PlayerResource:SetGold(playerID, PlayerResource:GetReliableGold(playerID) + gold, true)
		else
			this:addDelayedGoldExp(playerID, gold, exp)
		end
    end, DoUniqueString('addGoldExp'), 1)
end

-- Return an instance of this class
return lodVoting()
