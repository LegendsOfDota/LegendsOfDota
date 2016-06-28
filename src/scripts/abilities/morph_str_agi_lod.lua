function onToggleOnSTR( event )

	local caster = event.caster
	local ability = event.ability
	
	ability:ApplyDataDrivenModifier(caster, caster, "modifier_str_morph_trigger_lod", nil)
end

function onToggleOffSTR( event )

	local caster = event.caster
	local ability = event.ability
	
	caster:RemoveModifierByName("modifier_str_morph_trigger_lod")
	caster:StopSound("Hero_Morphling.MorphStrengh")
end

function onToggleOnAGI( event )

	local caster = event.caster
	local ability = event.ability
	
	ability:ApplyDataDrivenModifier(caster, caster, "modifier_agi_morph_trigger_lod", nil)
end


function onToggleOffAGI( event )

	local caster = event.caster
	local ability = event.ability
	
	caster:RemoveModifierByName("modifier_agi_morph_trigger_lod")
	caster:StopSound("Hero_Morphling.MorphAgility")
end

--Swaps Strength Morph and Agility Morph dependend on the Autocaststatus.
function swapAbilities( event )
		
	local caster = event.caster	
	
	local ability1 = event.ability
	local ability1Name = ability1:GetAbilityName()
	
	local ability2Name = event.ability2Name
	local ability2 = caster:FindAbilityByName(ability2Name)
	
	local autoCastStatus1 = ability1:GetAutoCastState()
	local autoCastStatus2 = ability2:GetAutoCastState()
	
	local toggleState1 = ability1:GetToggleState()
	local toggleState2 = ability2:GetToggleState()

	local ability1Index = ability1:GetAbilityIndex()
	local ability2Index = ability2:GetAbilityIndex()
	
	if autoCastStatus1 == true and ability2Index > ability1Index then
			caster:SwapAbilities(ability1Name, ability2Name, false, true)
		if autoCastStatus2 == false then
			ability2:ToggleAutoCast()
		end
		if toggleState1 == true and toggleState2 == false then
			ability1:ToggleAbility()
			ability2:ToggleAbility()
		end
	end

	if autoCastStatus2 == false and ability2Index < ability1Index then
		caster:SwapAbilities(ability1Name, ability2Name, true, false)
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
	if caster:IsHero() and caster:GetMana() >= manaCost and baseAgility >= pointsPerTick + 1  then
		caster:SpendMana(manaCost, ability)
		caster:SetBaseStrength(baseStrength + pointsPerTick)
		caster:SetBaseAgility(baseAgility - pointsPerTick)
		caster:CalculateStatBonus()
	end
end

--Starts the Agility Morph.
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
	if caster:IsHero() and caster:GetMana() >= manaCost and baseStrength >= pointsPerTick + 1 then
		caster:SpendMana(manaCost, ability)
		caster:SetBaseStrength(baseStrength - pointsPerTick)
		caster:SetBaseAgility(baseAgility + pointsPerTick)
		caster:CalculateStatBonus()
	end
end
	

--Turns off Toggle when owner dies.
function onOwnerDied( event )
	
	local caster = event.caster
	local abilityName = event.abilityName
	local ability = event.ability
	
	local ability2 = caster:FindAbilityByName(abilityName)
	
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
function upgradeAbility( event )
	
	local caster = event.caster
	
	local ability1 = event.ability
	local ability1Name = ability1:GetAbilityName()
	local ability1Level = ability1:GetLevel()

	local ability2Name = event.abilityName
	
	local ability2Handle = caster:FindAbilityByName(ability2Name)
	local ability2Level = ability2Handle:GetLevel()
	
	--Upgrade corresponing ability.
	if ability1Level ~= ability2Level then
		ability2Handle:SetLevel(ability1Level)
	end
	
	local modifierName = event.modifierName

	local toggleState = ability1:GetToggleState()
	
	--Reapply modifier to update values.
	if toggleState == true then
		caster:RemoveModifierByNameAndCaster(modifierName, caster)
		ability1:ApplyDataDrivenModifier(caster, caster, modifierName, nil)
	end
end