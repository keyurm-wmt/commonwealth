import moment from 'moment';
import { Request, Response, NextFunction } from 'express';

import { sequelize } from '../database';
import lookupCommunityIsVisibleToUser from '../util/lookupCommunityIsVisibleToUser';
import lookupAddressIsOwnedByUser from '../util/lookupAddressIsOwnedByUser';

export const Errors = {
  InvalidThread: 'Invalid thread',
};

const updateOffchainVote = async (models, req: Request, res: Response, next: NextFunction) => {
  const [chain, community, error] = await lookupCommunityIsVisibleToUser(models, req.body, req.user);
  if (error) return next(new Error(error));
  const [author, authorError] = await lookupAddressIsOwnedByUser(models, req);
  if (authorError) return next(new Error(authorError));

  // TODO: check that req.option is valid, and import options from shared/types
  // TODO: check and validate req.signature, instead of checking for author

  let vote = await models.OffchainVote.findOne({
    where: {
      thread_id: req.body.thread_id,
      address: req.body.address,
      chain: req.body.chain,
      community: req.body.community,
    }
  });

  const thread = await models.OffchainThread.findOne({
    where: community
      ? { id: req.body.thread_id, community: community.id }
      : { id: req.body.thread_id, chain: chain.id }
  });

  if (!thread) return next(new Error(Errors.InvalidThread));

  if (!vote) {
    await sequelize.transaction(async (t) => {
      vote = await models.OffchainVote.create({
        thread_id: req.body.thread_id,
        address: req.body.address,
        chain: req.body.chain,
        community: req.body.community,
        option: req.body.option,
      }, { transaction: t });

      // update denormalized vote count
      thread.offchain_voting_votes = (thread.offchain_voting_votes ?? 0) + 1;
      await thread.save({ transaction: t });
    });
  } else {
    vote.option = req.body.option;
    await vote.save();
  }

  return res.json({ status: 'Success', result: vote.toJSON() });
};

export default updateOffchainVote;