import { DemoSession, DEMO_STATUS } from '../models.js';
import { isUniqueDemoProduct } from './catalog.js';

export function createMongooseDemoRepository() {
  return {
    create(data) {
      return DemoSession.create(data);
    },

    findByTokenHash(tokenHash) {
      return DemoSession.findOne({ tokenHash });
    },

    async resetDue(tokenHash, now, checkoutTimeoutAt) {
      const session = await DemoSession.findOne({ tokenHash });
      if (!session) return null;

      let changed = false;
      for (const product of session.products) {
        const completionDue = product.resetAt && product.resetAt <= now;
        const checkoutDue =
          product.status === DEMO_STATUS.CHECKOUT_STARTED &&
          product.checkoutStartedAt &&
          product.checkoutStartedAt <= checkoutTimeoutAt;

        if (completionDue || checkoutDue) {
          const soldAfterConfirmation =
            completionDue &&
            product.status === DEMO_STATUS.PAID &&
            isUniqueDemoProduct(product.productKey);
          product.status = soldAfterConfirmation ? DEMO_STATUS.SOLD : DEMO_STATUS.READY;
          product.checkoutOperationId = null;
          product.checkoutSessionId = null;
          product.checkoutStartedAt = null;
          product.resetAt = null;
          product.demoOrderNumber = null;
          product.paidAt = null;
          product.mailAttemptedForCheckoutId = null;
          product.mailStatus = 'NONE';
          product.changedAt = now;
          product.eventVersion += 1;
          changed = true;
        }
      }

      if (changed) await session.save();
      return session;
    },

    reserve(tokenHash, productKey, now, resetAt) {
      return DemoSession.findOneAndUpdate(
        {
          tokenHash,
          products: { $elemMatch: { productKey, status: { $in: [DEMO_STATUS.READY, DEMO_STATUS.CANCELLED] } } }
        },
        {
          $set: {
            'products.$.status': DEMO_STATUS.RESERVED,
            'products.$.changedAt': now,
            'products.$.resetAt': resetAt,
            'products.$.demoOrderNumber': null,
            'products.$.paidAt': null,
            'products.$.mailAttemptedForCheckoutId': null,
            'products.$.mailStatus': 'NONE'
          },
          $inc: { 'products.$.eventVersion': 1 }
        },
        { new: true }
      );
    },

    claimCheckout(tokenHash, productKey, operationId, now) {
      return DemoSession.findOneAndUpdate(
        {
          tokenHash,
          products: { $elemMatch: { productKey, status: { $in: [DEMO_STATUS.READY, DEMO_STATUS.CANCELLED] } } }
        },
        {
          $set: {
            'products.$.status': DEMO_STATUS.CHECKOUT_STARTED,
            'products.$.checkoutOperationId': operationId,
            'products.$.checkoutStartedAt': now,
            'products.$.changedAt': now,
            'products.$.resetAt': null,
            'products.$.demoOrderNumber': null,
            'products.$.paidAt': null,
            'products.$.mailAttemptedForCheckoutId': null,
            'products.$.mailStatus': 'NONE'
          },
          $inc: { 'products.$.eventVersion': 1 }
        },
        { new: true }
      );
    },

    attachCheckout(tokenHash, productKey, operationId, checkoutSessionId, now) {
      return DemoSession.findOneAndUpdate(
        {
          tokenHash,
          products: { $elemMatch: { productKey, checkoutOperationId: operationId } }
        },
        {
          $set: {
            'products.$.checkoutSessionId': checkoutSessionId,
            'products.$.changedAt': now
          }
        },
        { new: true }
      );
    },

    rollbackCheckout(tokenHash, productKey, operationId, now) {
      return DemoSession.findOneAndUpdate(
        {
          tokenHash,
          products: { $elemMatch: { productKey, checkoutOperationId: operationId } }
        },
        {
          $set: {
            'products.$.status': DEMO_STATUS.READY,
            'products.$.checkoutOperationId': null,
            'products.$.checkoutSessionId': null,
            'products.$.checkoutStartedAt': null,
            'products.$.changedAt': now
          },
          $inc: { 'products.$.eventVersion': 1 }
        },
        { new: true }
      );
    },

    cancel(tokenHash, productKey, now, resetAt) {
      return DemoSession.findOneAndUpdate(
        {
          tokenHash,
          products: {
            $elemMatch: {
              productKey,
              status: DEMO_STATUS.CHECKOUT_STARTED
            }
          }
        },
        {
          $set: {
            'products.$.status': DEMO_STATUS.CANCELLED,
            'products.$.changedAt': now,
            'products.$.resetAt': resetAt
          },
          $inc: { 'products.$.eventVersion': 1 }
        },
        { new: true }
      );
    },

    markPaid({ sessionId, productKey, checkoutSessionId, eventId, now, resetAt, demoOrderNumber }) {
      return DemoSession.findOneAndUpdate(
        {
          _id: sessionId,
          processedWebhookEvents: { $ne: eventId },
          products: { $elemMatch: { productKey, checkoutSessionId, status: DEMO_STATUS.CHECKOUT_STARTED } }
        },
        {
          $addToSet: { processedWebhookEvents: eventId },
          $set: {
            'products.$.status': DEMO_STATUS.PAID,
            'products.$.changedAt': now,
            'products.$.resetAt': resetAt,
            'products.$.paidAt': now,
            'products.$.demoOrderNumber': demoOrderNumber,
            'products.$.mailStatus': 'NONE'
          },
          $inc: { 'products.$.eventVersion': 1 }
        },
        { new: true }
      );
    },

    claimMail(sessionId, productKey, checkoutSessionId, now) {
      return DemoSession.findOneAndUpdate(
        {
          _id: sessionId,
          products: {
            $elemMatch: {
              productKey,
              status: DEMO_STATUS.PAID,
              checkoutSessionId,
              mailAttemptedForCheckoutId: { $ne: checkoutSessionId }
            }
          }
        },
        {
          $set: {
            'products.$.mailAttemptedForCheckoutId': checkoutSessionId,
            'products.$.mailStatus': 'SENDING',
            'products.$.changedAt': now
          },
          $inc: { 'products.$.eventVersion': 1 }
        },
        { new: true }
      );
    },

    completeMail({ sessionId, productKey, checkoutSessionId, status, now }) {
      return DemoSession.findOneAndUpdate(
        {
          _id: sessionId,
          products: {
            $elemMatch: {
              productKey,
              status: DEMO_STATUS.PAID,
              checkoutSessionId,
              mailAttemptedForCheckoutId: checkoutSessionId,
              mailStatus: 'SENDING'
            }
          }
        },
        {
          $set: {
            'products.$.mailStatus': status,
            'products.$.changedAt': now
          },
          $inc: { 'products.$.eventVersion': 1 }
        },
        { new: true }
      );
    }
  };
}
