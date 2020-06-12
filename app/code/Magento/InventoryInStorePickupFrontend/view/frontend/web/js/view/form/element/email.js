/**
 * Copyright © Magento, Inc. All rights reserved.
 * See COPYING.txt for license details.
 */

define(['Magento_Checkout/js/view/form/element/email', 'Magento_Checkout/js/checkout-data'], function(
   Component,
   checkoutData
) {
    'use strict';
    return Component.extend({
        defaults: {
            template: 'Magento_InventoryInStorePickupFrontend/form/element/email',
            email: checkoutData.getInputFieldEmailValue()
        },
    });
});
