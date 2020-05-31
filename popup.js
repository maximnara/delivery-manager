
function render(data) {
    var orders = data.orders || [];
    var ordersElement = document.getElementById('orders');
    ordersElement.innerHTML = '';
    
    if (!orders.length) {
        var emptyBlock = document.createElement('div');
        emptyBlock.className = 'blk-empty';
        emptyBlock.innerHTML = "Use right mouse click context menu\n to save <span class=\"text-selected\">selected</span> delivery order number"
        ordersElement.append(emptyBlock);
    }
    
    orders.forEach(function(item, key) {
        var url = (new URL(item.pageUrl)).hostname;
        var row = document.createElement('div');
        row.className = 'order';
        var link = document.createElement('a');
        link.innerText = url + ': ' + item.orderNumber;
        link.onclick = function () {
            chrome.tabs.create({ url: 'http://' + url, active: true });
        };
        var deleteButton = document.createElement('span');
        deleteButton.className = 'btn-delete';
        deleteButton.title = 'Delivered'
        deleteButton.onclick = function () {
            orders = orders.filter(function(item, i) {
                return i != key;
            });
            chrome.storage.sync.set({ orders });
            chrome.storage.sync.get('orders', function(data) {
                render(data);
            });
        };
        row.append(link);
        row.append(deleteButton);
        ordersElement.append(row);
    });
}

chrome.storage.sync.get('orders', function(data) {
    render(data);
});