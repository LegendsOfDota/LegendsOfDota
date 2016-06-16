--[[
Title: Lua Script for bidirectional version of Morph(Strength and Agility)
Autor: TheRisen41
Date: 10.06.16
]]

function OnToggleOnSTR( event )

	local caster = event.caster
	local ability = event.ability
	
	ability:ApplyDataDrivenModifier(caster, caster, "modifier_str_morph_trigger_lod", nil)
end

function OnToggleOffSTR( event )

	local caster = event.caster
	local ability = event.ability
	
	caster:RemoveModifierByName("modifier_str_morph_trigger_lod")
	caster:StopSound("Hero_Morphling.MorphStrengh")
end

function OnToggleOnAGI( event )

	local caster = event.caster
	local ability = event.ability
	
	ability:ApplyDataDrivenModifier(caster, caster, "modifier_agi_morph_trigger_lod", nil)
end


function OnToggleOffAGI( event )

	local caster = event.caster
	local ability = event.ability
	
	caster:RemoveModifierByName("modifier_agi_morph_trigger_lod")
	caster:StopSound("Hero_Morphling.MorphAgility")
end

--Swaps Strength Morph and Agility Morph dependend on the Autocaststatus.
function SwapAbilities( event )
		
	local caster = event.caster	
	
	local ability1 = event.ability
	local ability1_name = ability1:GetAbilityName()
	
	local ability2_name = event.ability2_name
	local ability2 = caster:FindAbilityByName(ability2_name)
	
	local autoCastStatus1 = ability1:GetAutoCastState()
	local autoCastStatus2 = ability2:GetAutoCastState()
	
	local toggleState1 = ability1:GetToggleState()
	local toggleState2 = ability2:GetToggleState()

	local ability1Index = ability1:GetAbilityIndex()
	local ability2Index = ability2:GetAbilityIndex()
	
	--print("A1 Index = "..ability1Index..", A2 Index = "..ability2Index)
	
	if autoCastStatus1 == true and ability2Index > ability1Index then
			caster:SwapAbilities(ability1_name, ability2_name, false, true)
		if autoCastStatus2 == false then
			ability2:ToggleAutoCast()
		end
		if toggleState1 == true and toggleState2 == false then
			ability1:ToggleAbility()
			ability2:ToggleAbility()
		end
	end

	if autoCastStatus2 == false and ability2Index < ability1Index then
		caster:SwapAbilities(ability1_name, ability2_name, true, false)
		if autoCastStatus1 == true then
			ability1:ToggleAutoCast()
		end
		if toggleState2 == true and toggleState1 == false then
			ability1:ToggleAbility()
			ability2:ToggleAbility()
		end
	end
end

--Starts the Strength Morph.
function StrengthMorph( event )

	local caster = event.caster
	local ability = event.ability
	local autoCastStatus = ability:GetAutoCastState()
	
	local baseStrength = caster:GetBaseStrength()
	local baseAgility = caster:GetBaseAgility()
	
	local pointsPerTick = event.pointsPerTick
	local shiftRate = event.shiftRate
	local manaCost = event.manaCostPerSecond * shiftRate
	
	--If conditions are met Strength Morph begins.		
	if caster:IsHero() and caster:GetMana() >= manaCost and baseAgility >= pointsPerTick + 1  then
		caster:SpendMana(manaCost, ability)
		caster:SetBaseStrength(baseStrength + pointsPerTick)
		caster:SetBaseAgility(baseAgility - pointsPerTick)
		caster:CalculateStatBonus()
	end
end

--Starts the Agility Morph.
function AgilityMorph( event )
	
	local caster = event.caster
	local ability = event.ability
	local autoCastStatus = ability:GetAutoCastState()
	
	local baseStrength = caster:GetBaseStrength()
	local baseAgility = caster:GetBaseAgility()
	
	local pointsPerTick = event.pointsPerTick
	local shiftRate = event.shiftRate
	local manaCost = event.manaCostPerSecond * shiftRate
	
	--If conditions are met Agility Morph begins.
	if caster:IsHero() and caster:GetMana() >= manaCost and baseStrength >= pointsPerTick + 1 then
		caster:SpendMana(manaCost, ability)
		caster:SetBaseStrength(baseStrength - pointsPerTick)
		caster:SetBaseAgility(baseAgility + pointsPerTick)
		caster:CalculateStatBonus()
	end
end
	

--Turns off Toggle when owner dies.
function WhenCasterDies( event )
	
	local caster = event.caster
	local ability_name = event.ability_name
	local ability = event.ability
	
	local ability2 = caster:FindAbilityByName(ability_name)
	
	local ability1State = ability:GetToggleState()
	local ability2State = ability2:GetToggleState()
	
	if ability1State == true then
		ability:ToggleAutoCast()
	end

	if ability2State == true then
		ability2:ToggleAutoCast()
	end
end

--Upgrades corresponing Ability and re-applies the modifier to update the values.
function UpgradeAbility( event )
	
	local caster = event.caster
	
	local ability1 = event.ability
	local ability1Name = ability1:GetAbilityName()
	local ability1Level = ability1:GetLevel()

	local ability2Name = event.ability_name
	
	local ability2Handle = caster:FindAbilityByName(ability2Name)
	local ability2Level = ability2Handle:GetLevel()
	
	--Upgrade corresponing ability.
	if ability1Level ~= ability2Level then
		ability2Handle:SetLevel(ability1Level)
	end
	
	local modifier_name = event.modifier_name
	--print(modifier_name)
	
	local toggleState = ability1:GetToggleState()
	
	--Reapply modifier to update values.
	if toggleState == true then
		caster:RemoveModifierByNameAndCaster(modifier_name, caster)
		ability1:ApplyDataDrivenModifier(caster, caster, modifier_name, nil)
	end
end