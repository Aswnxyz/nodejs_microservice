const shoppingService = require("../services/shopping-service");

module.exports = (app) => {
  const service = new shoppingService();
  app.use("/app-events", async (req, res, next) => {
    const { payload } = req.body;

    //handle subscribe events
    service.SubscribeEvents(payload);

    console.log(
      "============= Shopping Service Received Event ================"
    );
    console.log(payload);
    return res.status(200).json(payload);
  });
};
