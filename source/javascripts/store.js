//=======================================================================
//
// "Blocks" Store : store.js
// Copyright (c) 2005-2008 Big Cartel, LLC. All rights reserved.
//
//=======================================================================
 
function observeOnFocus(element, frequency, callback) {
  element.observe('focus', function() {
    element.observer = new Form.Element.Observer(element, frequency, callback);
  });
  element.observe('blur', function() {
    element.observer.stop();
    element.observer = null;
  });
}
 
Effect.BlindFade = function(element) {
  element = $(element);
  return new Effect.Parallel([ new Effect.BlindUp(element), new Effect.Fade(element) ],
    Object.extend({ duration: 0.5, afterFinishInternal: function(effect) {
      if($(element.id)) element.remove();
    }
  }, arguments[1] || { }));
};
 
var Store = {
 
  error_div:        'error',
  currency_sign:      '$',
  item_singular:      'item',
  item_plural:      'items',
  show_shipping:  false,
 
  initialize: function() {
 
    var owner = this;
        owner.inPreview = (/\/admin\/design/.test(top.location.pathname));
    var id    = document.body.id;
 
    API.onError = function(error) {
      owner.onError(error);
    }
 
    this.detectCookies();
 
    if(id == 'product') {
      this.initProductPage();
    } else if(id == 'cart') {
      this.initCartPage();
    } else if(id == 'contact') {
      this.initContactPage();
    }
  },
 
  onError: function(error) {    
    if(Object.prototype.toString.call(error) === '[object Array]') { error = error.join("</li><li>"); }
    else if(error.match(/syntax error/i)) { return true; }
 
    error  = "<li>" + error + "</li>";
    var div = $(this.error_div);
 
    if(div) {
      div.update('<ul>' + error + '</ul>');
    } else {
      $('page_name').insert({ after: '<div class="' + this.error_div + '" id="' + this.error_div + '"><ul>' + error + '</ul></div>' });
      div = $(this.error_div);
    }
 
    div.hide();
    div.scrollTo();
 
    div.blindDown({ duration: 0.3 });
 
    var add = $('adding_to_cart');
    if(add) add.hide();
  },
 
  clearErrors: function() {
    var div = $(this.error_div);
    if(div) div.remove();
  },
 
  detectCookies: function() {
    var cookieEnabled = navigator.cookieEnabled;
 
    if(typeof navigator.cookieEnabled=="undefined" && !cookieEnabled) {
      document.cookie = "testcookie"
      cookieEnabled = document.cookie.indexOf("testcookie") != -1;
    }
 
    if(!cookieEnabled) {
      this.onError("Cookies must be enabled to use this store");
    }
  },
 
  initProductPage: function() {
    var owner  = this;
    var adding  = $('adding_to_cart');
    var added  = $('added_to_cart');
    var form  = $('product_form');
    var mini  = $('minicart');
    var options = { duration: .25, queue: { position: 'end', scope: 'add' }};
 
    // preload product images
    var img = new Image();
    $$('#product_images a').each(function(elm) {
      img.src = elm.href;
    });
 
    setupZoom();
 
    if(form) {
      form.onsubmit = function() {
        owner.clearErrors();
        adding.appear({ duration: 0.25 });
        Cart.addItem(this.serialize(true)['cart[add][id]'], 1, function(cart) {
          mini.slideUp(Object.extend(options, { afterFinish: function() {
            owner.updateMiniCart(cart);
          }}));
 
          mini.slideDown(Object.extend(options, { afterFinish: function() {
            adding.hide();
            added.show();
            added.fade({ duration: 0.3, delay: 3 });
          }}));
        });
        return false;
      }
    }
  },
 
  updateMiniCart: function(cart) {
    this.updateAmount($('minicart_count'), Format.pluralize(cart.item_count, this.item_singular, this.item_plural));
  },
 
  initCartPage: function() {
    var owner = this;
 
    $$('#cart_contents input').each(function(element) {
      observeOnFocus(element, 0.3, function() {
        if (element.value != '')
          owner.updateCart();
      });
    });
 
    $$('#cart_discount_code, #country').each(function(element) {
      element.onchange = function() {
        owner.updateCart();
      }
    });
  },
 
  updateCart: function() {
    this.clearErrors();
    Cart.updateFromForm('cart_form', this.onCartUpdate.bind(this));
  },
 
  removeItem: function(id) {
    var owner = this;
    this.clearErrors();
    new Effect.BlindFade('item_' + id, { afterFinish: function() {
      Cart.removeItem(id, owner.onCartUpdate.bind(owner));
    }});
  },
 
  removeCart: function() {
    this.clearErrors();
    var cart_form = $('cart_form');
    if(!cart_form) return;
    cart_form.fade({ duration: 0.3 });
    $('cart_empty').appear({ delay: 0.3, duration: 0.3, afterFinish: function(){ cart_form.remove(); }});
  },
 
  onCartUpdate: function(cart) {
    var owner   = this;
    var shipping = $('shipping_total');
    var discountEntry = $('discount_entry');
    var discountTotal = $('discount_total');
    var price   = $('cart_price');
    var removed   = 0;
 
    this.updateMiniCart(cart);
 
    if(cart.item_count > 0) {
 
      // update item prices
      $$('.item_total').each(function(div, index) {
        var id   = Number(div.id.split('_')[1]);
        var item = cart.items[index - removed];
        if(item && id == item.id) {
          owner.updateAmount(div, owner.toMoney(item.price));
        } else {
          removed++;
          new Effect.BlindFade('item_' + id);
        }
      });
 
      // update shipping
      if(this.show_shipping && shipping && cart.shipping) {
        cart.shipping.pending ? shipping.hide() : shipping.show();
        if (!cart.shipping.pending) {
          this.updateAmount(shipping, this.toMoney(cart.shipping.amount));
        }

        if (!cart.shipping.strict && $('country')) {
          $('country').hide();
        }
      }
 
      // update discount
      if(discountEntry && cart.discount) {
        if(cart.discount.free_shipping) {
          discountEntry.hide();
          discountTotal.addClassName('shipping');
          this.updateAmount(discountTotal, cart.discount.name);
        } else {
          discountEntry.update(cart.discount.name);
          discountEntry.show();
          discountTotal.removeClassName('shipping');
          this.updateAmount(discountTotal, this.toMoney(cart.discount.amount));
        }
      }
 
      //  update total price
      this.updateAmount(price, this.show_shipping && !cart.shipping.pending ? this.toMoney(cart.total) : this.toMoney(cart.price));
 
    } else {
      setTimeout(function(){ owner.removeCart(); }, 500);
    }
  },
 
  updateAmount: function(elm, html) {
    var before = elm.innerHTML;
    elm.update(html);
    if(before != elm.innerHTML) elm.pulsate({ pulses: 1, duration: 0.25 });
  },
 
  toMoney: function(n) {
    return Format.money(n, true, true);
  },
 
  initContactPage: function() {
    if(!this.inPreview) {
      try { document.forms[0].focusFirstElement(); } catch(e) { }
    }
  }
 
};
 
Event.observe(window, 'load', function(){ Store.initialize(); }, false);
