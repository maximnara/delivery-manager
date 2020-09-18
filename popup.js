let runtimeConnection = null;

function render(data) {
    var orders = data.orders || [];
    var ordersElement = document.getElementById('orders');
    ordersElement.innerHTML = '';
    
    if (!orders.length && !loading) {
        var emptyBlock = document.createElement('div');
        emptyBlock.className = 'blk-empty';
        emptyBlock.innerHTML = "Use right mouse click context menu\n to save <span class=\"text-selected\">selected</span> delivery order number"
        ordersElement.append(emptyBlock);
    }
    
    if (!orders.length && loading) { //  || orderListChanged && loading
        var emptyBlock = document.createElement('div');
        emptyBlock.className = 'loader load3';
        emptyBlock.innerHTML = "Loading..."
        ordersElement.append(emptyBlock);
    }
    
    orders.forEach(function(item, key) {
        if (!item.pageUrl) {
            return;
        }
        var url = (new URL(item.pageUrl)).hostname;
        var row = document.createElement('div');
        row.className = 'order';
        var name = document.createElement('div');
        name.className = 'name';
        name.title = item.date;
        var link = document.createElement('a');
        link.innerText = url;
        link.onclick = function () {
            chrome.tabs.create({ url: item.pageUrl, active: true });
        };
        var orderNumber = document.createElement('span');
        orderNumber.innerText = ' - ' + item.orderNumber;
        var deleteButton = document.createElement('span');
        deleteButton.className = 'btn-delete';
        deleteButton.title = 'Delivered'
        deleteButton.onclick = function () {
            runtimeConnection.postMessage({ type: 'delete-order', data: { id: item.id } }, function(response) {
                if (response) {
                    orders = orders.filter(function(item, i) {
                        return i != key;
                    });
                    chrome.storage.sync.set({ orders });
                    chrome.storage.sync.get('orders', function(data) {
                        render(data);
                    });
                }
            });
        };
        name.append(link);
        name.append(orderNumber);
        row.append(name);
        row.append(deleteButton);
        ordersElement.append(row);
    });
    
    chrome.storage.sync.get('user', function(data) {
        const publicId = data.user.publicId;
        const token = data.user.token;
        if (!data.user.hasTelegram) {
            document.getElementById('telegram-link').onclick = function () {
                chrome.tabs.create({ url: 'https://t.me/DeliveryManagerBot?start=' + publicId, active: true });
            };
        }
    });
}

function prepareDataForRender(rawData) {
    return rawData.reduce(function(result, item) {
        result.push({
            id: item.id,
            pageUrl: item.page_url,
            date: item.created_at,
            orderNumber: item.number,
        })
        return result
    }, [])
}

let loading = true;
let isPopupActive = false;
let orderListChanged = false;
async function main() {
    runtimeConnection = await chrome.runtime.connect();
    runtimeConnection.postMessage({ type: 'popup-active', data: true });
    
    chrome.storage.sync.get('orders', function(data) {
        render(data);
    });
    
    runtimeConnection.onMessage.addListener(
        async function(request, sender) {
            if (request.type == 'get-orders') {
                let data = prepareDataForRender(request.data.orders)
                loading = false
                render({ orders: data })
            }
        }
    );
}

main()