--Taken from the spelllibrary, credits go to valve

modifier_flesh_heap_agi = class({})



--------------------------------------------------------------------------------

function modifier_flesh_heap_agi:OnCreated( kv )
	self.fleshHeapAgilityBuffAmount = self:GetAbility():GetSpecialValueFor( "flesh_heap_agility_buff_amount" )
	if IsServer() then
		self:SetStackCount( self:GetAbility():GetFleshHeapKills() )
		self:GetParent():CalculateStatBonus()
	end
end

--------------------------------------------------------------------------------

function modifier_flesh_heap_agi:OnRefresh( kv )
	self.fleshHeapAgilityBuffAmount = self:GetAbility():GetSpecialValueFor( "flesh_heap_agility_buff_amount" )
	if IsServer() then
		self:GetParent():CalculateStatBonus()
	end
end

--------------------------------------------------------------------------------

function modifier_flesh_heap_agi:DeclareFunctions()
	local funcs = {
		MODIFIER_PROPERTY_STATS_AGILITY_BONUS
	}

	return funcs
end

--------------------------------------------------------------------------------


function modifier_flesh_heap_agi:GetModifierBonusStats_Agility( params )
	return self:GetStackCount() * self.fleshHeapAgilityBuffAmount
end
