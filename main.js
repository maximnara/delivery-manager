
chrome.contextMenus.create({
    id: "delivery-manager",
    title: "Delivery: this is order number",
    contexts:  ["selection"],
    onclick: function(info, tab) {
        var orderNumber = info.selectionText;
        var pageUrl = info.pageUrl;
        chrome.storage.sync.get('orders', function(data) {
            var orders = data.orders || [];
            var dateString = (new Date()).toLocaleDateString("en-US", { weekday: 'long', month: 'long', day: 'numeric' });
            orders.push({ orderNumber, pageUrl, date: dateString });
            chrome.storage.sync.set({'orders': orders}, function() {
                console.log('Order number saved');
            });
        });
    },
});