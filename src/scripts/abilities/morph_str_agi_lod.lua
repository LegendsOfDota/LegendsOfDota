--[[
Title: Lua Script for bidirectional version of Morph(Strength and Agility)
Autor: TheRisen41
Date: 10.06.16
]]

--Swaps Strength Morph with Agility Morph and turns off auto-cast if necessary.
function swapStrToAgi( event )
			
		local caster = event.caster	
		local ability = event.ability
		
		local main_ability_name = ability:GetAbilityName()
		local sub_ability_name = event.sub_ability_name
		
		--Swaps Abilities		
		caster:SwapAbilities(main_ability_name, sub_ability_name, false, true)
		
		local autoCastStatusMain = ability:GetAutoCastState()
		
		--Turns off auto-cast if it was left on.
		if autoCastStatusMain == true then
			ability:ToggleAutoCast()
		end
end

--Swaps Agility Morph with Strength Morph and turns off auto-cast if necessary.
function swapAgiToStr( event )
			
		local caster = event.caster	
		local sub_ability = event.ability
		
		local main_ability_name = event.main_ability_name
		local sub_ability_name = sub_ability:GetAbilityName()
		
		--Swaps Abilities
		caster:SwapAbilities(main_ability_name, sub_ability_name, true, false)
		
		local autoCastStatusSub = sub_ability:GetAutoCastState()
		
		--Turns off auto-cast if it was left on.
		if autoCastStatusSub == true then
			sub_ability:ToggleAutoCast()
		end
end

--Starts the Strength Morph if auto-cast is on and applies Particels and Sound.
function strengthMorph( event )

	local caster = event.caster
	local ability = event.ability
	local autoCastStatus = ability:GetAutoCastState()
	
	local baseStrength = caster:GetBaseStrength()
	local baseAgility = caster:GetBaseAgility()
	
	local pointsPerTick = event.pointsPerTick
	local shiftRate = event.shiftRate
	local manaCost = event.manaCostPerSecond * shiftRate
	
	--If conditions are met Strength Morph begins.
	--Starts and stops Sound and Particles.
	if autoCastStatus == true then
	
		ability:ApplyDataDrivenModifier(caster, caster, "str_morph_particle", nil)
		
		if caster:IsHero() and caster:GetMana() >= manaCost and baseAgility >= pointsPerTick + 1  then
			caster:SpendMana(manaCost, ability)
			caster:SetBaseStrength(baseStrength + pointsPerTick)
			caster:SetBaseAgility(baseAgility - pointsPerTick)
			caster:CalculateStatBonus()
		end
	else
		caster:StopSound("Hero_Morphling.MorphStrengh")
		caster:RemoveModifierByName("str_morph_particle")
	end
end

--Starts the Agility Morph if auto-cast is on and applies Particels and Sound.
function agilityMorph( event )
	
	local caster = event.caster
	local ability = event.ability
	local autoCastStatus = ability:GetAutoCastState()
	
	local baseStrength = caster:GetBaseStrength()
	local baseAgility = caster:GetBaseAgility()
	
	local pointsPerTick = event.pointsPerTick
	local shiftRate = event.shiftRate
	local manaCost = event.manaCostPerSecond * shiftRate
	
	--If conditions are met Agility Morph begins.
	--Starts and stops Sound and Particles.
	if autoCastStatus == true then
	
		ability:ApplyDataDrivenModifier(caster, caster, "agi_morph_particle", nil)
		
		if caster:IsHero() and caster:GetMana() >= manaCost and baseStrength >= pointsPerTick + 1 then
			caster:SpendMana(manaCost, ability)
			caster:SetBaseStrength(baseStrength - pointsPerTick)
			caster:SetBaseAgility(baseAgility + pointsPerTick)
			caster:CalculateStatBonus()
		end
	else
		caster:StopSound("Hero_Morphling.MorphAgility")
		caster:RemoveModifierByName("agi_morph_particle")
	end
end
	

--Turns of auto-cast when owner dies.
function whenCasterDies( event )
	
	print("OWNER IS DEAD!!!!")
	local caster = event.caster
	local ability_name = event.ability_name
	local ability = event.ability
	
	local ability2 = caster:FindAbilityByName(ability_name)
	
	local ability1State = ability:GetAutoCastState()
	local ability2State = ability2:GetAutoCastState()
	
	if ability1State == true then
		ability:ToggleAutoCast()
	end

	if ability2State == true then
		ability2:ToggleAutoCast()
	end
end

--Upgrades corresponing Ability and re-applies the modifier to update the values.
function upgradeAbility( event )
	
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
	
	--Reapply modifier to update values.
	caster:RemoveModifierByNameAndCaster(modifier_name, caster)
	ability1:ApplyDataDrivenModifier(caster, caster, modifier_name, nil)
end