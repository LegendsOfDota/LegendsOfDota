function melting_strike_autocast( keys )

	local attacker = keys.attacker
	local ability = keys.ability
	local ability_level = ability:GetLevel() - 1
	local target = keys.target

	local minusArmorAmt = ability:GetLevelSpecialValueFor("minus_armor", ability_level) * -1
	local maxArmorAmt = ability:GetLevelSpecialValueFor("max_minus_armor", ability_level)
	local duration = ability:GetLevelSpecialValueFor("duration", ability_level)
	local manaCost = ability:GetLevelSpecialValueFor("mana_cost", ability_level)
	local stackCount = 0
	local modifierMinusArmor = keys.modifier_minus_armor

	if target:IsHero() and attacker:GetMana() >= manaCost and not attacker:IsIllusion then

		if target:HasModifier(modifierMinusArmor) then
			stackCount = target:GetModifierStackCount(modifierMinusArmor, ability)
			target:RemoveModifierByName(modifierMinusArmor)
		end

		stackCount = stackCount + minusArmorAmt
		if stackCount > maxArmorAmt then stackCount = maxArmorAmt end

		ability:ApplyDataDrivenModifier(attacker, target, modifierMinusArmor, {duration = duration}) 
		target:SetModifierStackCount(modifierMinusArmor, ability, stackCount)

		attacker:SpendMana(manaCost, ability)
	end
end
