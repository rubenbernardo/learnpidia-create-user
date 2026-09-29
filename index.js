module.exports = async function (context) {

    context.log("Create Learnpidia User Function started.");

    return context.res.json({
        success: true,
        message: "Function is connected successfully."
    });

};
