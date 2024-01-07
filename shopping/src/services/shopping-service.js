const { ShoppingRepository } = require("../database");
const { FormateData, RPCRequest } = require("../utils");

// All Business logic will be here
class ShoppingService {
  constructor() {
    this.repository = new ShoppingRepository();
  }

  //Cart Info
  async AddCartItem(customerId, product_id, qty) {
    //Grab Product info from product Service through RPC
    const productResponse = await RPCRequest("PRODUCT_RPC", {
      type: "VIEW_PRODUCT",
      data: product_id,
    });
    console.log(productResponse);
    if (productResponse && productResponse._id) {
      const data = await this.repository.ManageCart(
        customerId,
        productResponse,
        qty
      );
      return data;
    }
    throw new Error("Product data not found!");
  }
  async RemoveCartItem(customerId, product_id) {
    return await this.repository.ManageCart(
      customerId,
      { _id: product_id },
      0,
      true
    );
  }

  async GetCart(_id) {
    try {
      return this.repository.Cart(_id);
    } catch (error) {
      throw error;
    }
  }

  //Wishlist
  async AddTOWishlist(customerId, product_id) {
    return this.repository.ManageWishlist(customerId, product_id);
  }
  async RemoveFromWishlist(customerId, product_id) {
    return this.repository.ManageWishlist(customerId, product_id, true);
  }
  async GetWishlist(customerId) {
    const wishlist = await this.repository.GetWishlistByCustomerId(
      customerId
    );
    if(!wishlist){
      return {}
    }
    const {products}=wishlist
    if (Array.isArray(products)) {
      const ids = products.map(({ _id }) => _id);
      //Perform RPC call
      const productResponse = await RPCRequest("PRODUCT_RPC", {
        type: "VIEW_PRODUCTS",
        data: ids,
      });
      if (productResponse) {
        return productResponse;
      }
    }

    return {};
  }

  //Orders

  async CreateOrder(customerId, txnNumber) {
    try {
      return this.repository.CreateNewOrder(customerId, txnNumber);
    } catch (err) {
      throw new APIError("Data Not found", err);
    }
  }

  async GetOrder(OrderId) {
    try {
      return this.repository.Orders("", OrderId);
    } catch (err) {
      throw new APIError("Data Not found", err);
    }
  }
  async GetOrders(customerId) {
    try {
      return this.repository.Orders(customerId);
    } catch (err) {
      throw new APIError("Data Not found", err);
    }
  }

  async ManageCart(customerId, item, qty, isRemove) {
    try {
      const cartResult = await this.repository.AddCartItem(
        customerId,
        item,
        qty,
        isRemove
      );
      return FormateData(cartResult);
    } catch (error) {
      throw error;
    }
  }

  async SubscribeEvents(payload) {
    payload = JSON.parse(payload);
    const { event, data } = payload;

    const { userId, product, qty } = data;

    switch (event) {
      case "ADD_TO_CART":
        this.ManageCart(userId, product, qty, false);
        break;
      case "REMOVE_FROM_CART":
        this.ManageCart(userId, product, qty, true);
        break;
      default:
        break;
    }
  }

  async deleteProfileData(customerId){
    return  this.repository.deleteProfileData(customerId)
  }

  async SubscribeEvents(payload) {
    payload = JSON.parse(payload);
    const { event, data } = payload;
    switch (event) {
      case "DELETE_PROFILE":
        await this.deleteProfileData(data.userId);
        break;
      default:
        break;
    }
  }

  // async GetOrderPayload(userId, order, event) {
  //   if (order) {
  //     const payload = {
  //       event: event,
  //       data: { userId, order },
  //     };
  //     return payload;
  //   } else {
  //     return FormateData({ error: "No Order is available" });
  //   }
  // }
}

module.exports = ShoppingService;
