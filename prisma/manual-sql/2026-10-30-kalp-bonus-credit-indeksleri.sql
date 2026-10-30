CREATE UNIQUE INDEX "KalpBonusCredit_splitFromId_key" ON "KalpBonusCredit"("splitFromId");
CREATE UNIQUE INDEX "KalpBonusCredit_root_unique" ON "KalpBonusCredit"("inviteId") WHERE ("splitFromId" IS NULL);
