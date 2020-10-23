/**
 * Copyright © Magento, Inc. All rights reserved.
 * See COPYING.txt for license details.
 */

define([
    'uiComponent',
    'underscore',
    'jquery',
    'knockout',
    'uiRegistry',
    'Magento_Checkout/js/model/quote',
    'Magento_Checkout/js/action/select-shipping-method',
    'Magento_Checkout/js/checkout-data',
    'Magento_Checkout/js/model/shipping-service',
    'Magento_Checkout/js/model/step-navigator',
    'Magento_Checkout/js/model/shipping-rate-service',
    'Magento_Checkout/js/model/address-converter',
    'Magento_InventoryInStorePickupFrontend/js/model/shipping-rate-processor/store-pickup-address',
    'Magento_InventoryInStorePickupFrontend/js/model/pickup-locations-service',
], function(
    Component,
    _,
    $,
    ko,
    registry,
    quote,
    selectShippingMethodAction,
    checkoutData,
    shippingService,
    stepNavigator,
    shippingRateService,
    addressConverter,
    shippingRateProcessor,
    pickupLocationsService
) {
    'use strict';

    return Component.extend({
        defaults: {
            template: 'Magento_InventoryInStorePickupFrontend/store-pickup',
            deliveryMethodSelectorTemplate:
                'Magento_InventoryInStorePickupFrontend/delivery-method-selector',
            isVisible: false,
            isAvailable: false,
            isStorePickupSelected: false,
            rate: {
                carrier_code: 'in_store',
                method_code: 'pickup',
            },
            nearbySearchRadius: 5000,
            nearbySearchLimit: 50,
            defaultCountry: window.checkoutConfig.defaultCountryId,
        },
        rates: shippingService.getShippingRates(),
        inStoreMethod: null,

        initialize: function() {
            this._super();

            shippingRateService.registerProcessor(
                'store-pickup-address',
                shippingRateProcessor
            );

            quote.shippingAddress.subscribe(function(shippingAddress) {
                this.convertAddressType(shippingAddress);
            }, this);
            this.convertAddressType(quote.shippingAddress());

            this.isStorePickupSelected.subscribe(function() {
                this.preselectLocation();
            }, this);
            this.preselectLocation();

            this.syncWithShipping();
        },
        initObservable: function() {
            this._super().observe(['isVisible']);

            this.isStorePickupSelected = ko.pureComputed(function() {
                return _.isMatch(quote.shippingMethod(), this.rate);
            }, this);

            this.isAvailable = ko.pureComputed(function() {
                return _.findWhere(this.rates(), {
                    carrier_code: this.rate.carrier_code,
                    method_code: this.rate.method_code,
                });
            }, this);

            return this;
        },
        /**
         * Synchronize store pickup visibility with shipping step.
         */
        syncWithShipping: function() {
            var shippingStep = _.findWhere(stepNavigator.steps(), {
                code: 'shipping',
            });
            shippingStep.isVisible.subscribe(function(isShippingVisible) {
                this.isVisible(this.isAvailable && isShippingVisible);
            }, this);
            this.isVisible(this.isAvailable && shippingStep.isVisible());
        },
        selectShipping: function() {
            var nonPickupShippingMethod = _.find(
                this.rates(),
                function(rate) {
                    return (
                        rate.carrier_code !== this.rate.carrier_code &&
                        rate.method_code !== this.rate.method_code
                    );
                },
                this
            );

            this.selectShippingMethod(nonPickupShippingMethod);

            if(checkoutData.getSelectedShippingAddress() === 'store-pickup-address') {
                registry.async('checkoutProvider')(function(checkoutProvider) {
                    checkoutProvider.set(
                        'shippingAddress',
                        addressConverter.formAddressDataToQuoteAddress({})
                    );
                    checkoutProvider.trigger('data.reset');
                });
            }
        },
        selectStorePickup: function() {
            var pickupShippingMethod = _.find(
                this.rates(),
                function(rate) {
                    return (
                        rate.carrier_code === this.rate.carrier_code &&
                        rate.method_code === this.rate.method_code
                    );
                },
                this
            );

            this.preselectLocation();
            this.selectShippingMethod(pickupShippingMethod);
        },
        /**
         * @param {Object} shippingMethod
         */
        selectShippingMethod: function(shippingMethod) {
            selectShippingMethodAction(shippingMethod);
            checkoutData.setSelectedShippingRate(shippingMethod['carrier_code'] + '_' + shippingMethod['method_code']);
        },
        convertAddressType: function(shippingAddress) {
            if (
                !this.isStorePickupAddress(shippingAddress) &&
                this.isStorePickupSelected()
            ) {

                quote.shippingAddress(
                    $.extend({}, shippingAddress, {
                        canUseForBilling: function() {
                            return false;
                        },
                        getType: function() {
                            return 'store-pickup-address';
                        },
                    })
                );
            }
        },
        preselectLocation: function() {
            if (!this.isStorePickupSelected()) {
                return;
            }

            var selectedLocation = pickupLocationsService.selectedLocation();
            if (selectedLocation) {
                pickupLocationsService.selectForShipping(selectedLocation);
                return;
            }

            var shippingAddress = quote.shippingAddress();
            var customAttributes = shippingAddress.customAttributes || [];
            var selectedSourceCode = _.findWhere(customAttributes, {
                attribute_code: 'sourceCode',
            });

            if (selectedSourceCode) {
                pickupLocationsService
                    .getLocation(selectedSourceCode.value)
                    .then(function(location) {
                        pickupLocationsService.selectForShipping(location);
                    });
            } else if (shippingAddress.city && shippingAddress.postcode) {
                pickupLocationsService
                    .getNearbyLocations({
                        radius: this.nearbySearchRadius,
                        pageSize: this.nearbySearchLimit,
                        city: shippingAddress.city,
                        postcode: shippingAddress.postcode,
                        region: shippingAddress.region,
                        country: this.defaultCountry,
                    })
                    .then(function(locations) {
                        var nearestLocation = locations[0];

                        if (nearestLocation) {
                            pickupLocationsService.selectForShipping(
                                nearestLocation
                            );
                        }
                    });
            }
        },
        isStorePickupAddress: function(address) {
            return address && address.getType() === 'store-pickup-address';
        },
    });
});
