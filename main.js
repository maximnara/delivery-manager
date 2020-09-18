require.config({
    paths: { 
        "bcrypt": "/lib/bcrypt.min",
        "bluebird": "/lib/bluebird.min",
        "axios": "/lib/axios.min",
    }
});
let user = undefined

chrome.contextMenus.create({
    id: "delivery-manager-order-nmbr",
    title: "Delivery: this is order number",
    contexts:  ["selection"],
    onclick: function(info, tab) {
        var orderNumber = info.selectionText;
        var pageUrl = info.pageUrl;
        chrome.storage.sync.get('orders', async function(data) {
            var orders = data.orders || [];
            var dateString = (new Date()).toLocaleDateString("en-US", { weekday: 'long', month: 'long', day: 'numeric' });
            let order = { orderNumber, pageUrl, date: dateString }
            let dbOrder = await sendOrderNumber(order)
            order.id = dbOrder.id
            orders.push(order);
            chrome.storage.sync.set({'orders': orders}, function() {
                console.log('Order number saved');
            });
        });
    },
});

function ordersListChanged(orders) {
    return new Promise(function(resolve, reject) {
        chrome.storage.sync.get('orders', async function(data) {
            if (!data.orders || !orders) {
                return resolve(true)
            }
            if (data.orders.length != orders.length) {
                resolve(true)
            }
            let storageIds = data.orders.map(function(order) {
                return order.id;
            });
            let result = false;
            let dbIds = orders.filter(function(order) {
                if (storageIds.indexOf(order.id) > -1) {
                    result = true;
                }
            });
            resolve(result)
        });
    })
}

function prepareOrders(rawData) {
    return rawData.reduce(function(result, item) {
        result.push({
            id: item.id,
            pageUrl: item.page_url,
            date: (new Date(item.created_at)).toLocaleDateString("en-US", { weekday: 'long', month: 'long', day: 'numeric' }),
            orderNumber: item.number,
        })
        return result
    }, [])
}

async function saveOrdersToLocalStorage(orders) {
    return new Promise(function(resolve, reject) {
        let preparedOrders = prepareOrders(orders)
        chrome.storage.sync.set({ 'orders': preparedOrders }, function() {
            resolve(true)
        });
    })
}

async function sendOrderNumber(order) {
    let result = await axios.post('https://delivery-manager.luzh.io/order/add', {
        public_id: user.publicId, 
        token: user.token, 
        order,
    })
    return result.data
}

async function removeOrderNumberInDatabase(orderId) {
    let result = await axios.delete('https://delivery-manager.luzh.io/order/' + orderId + '?' + new URLSearchParams({
        public_id: user.publicId, 
        token: user.token, 
        order_id: orderId,
    }).toString())
    return result.data
}

let ordersRequest = null;
let ordersPromise = null;
async function getOrders() {
    if (!ordersRequest) {
        ordersPromise = null
    }
    if (ordersPromise) {
        return ordersPromise
    }
    ordersPromise = new Promise(async function(resolve, reject) {
        ordersRequest = axios.get('https://delivery-manager.luzh.io/orders?' + new URLSearchParams({ public_id: user.publicId, token: user.token }).toString())
        try {
            let result = await ordersRequest
            resolve(result.data)
        } catch(error) {
            reject(error)
        }
        ordersRequest = null
    })
    return ordersPromise;
}
    
async function getUser() {
    return new Promise(function(resolve) {
        return chrome.storage.sync.get('user', function (user) {
            resolve(user.user)
        });
    });
}

async function saveUserId() {
    if (user && user.userId) {
        return;
    }
    const publicId = getRandomToken();
    user = await createUser(publicId);
    const hashedId = bcrypt.hashSync(user.id + publicId, 10);
    return new Promise(function(resolve) {
        user = { 'userId': user.id, publicId: publicId, hashedId: hashedId, 'token': user.token, hasTelegram: user.hasTelegram };
        chrome.storage.sync.set({ user: user }, function() {
            resolve(user);
        });
    });
}

function getRandomToken() {
    var randomPool = new Uint8Array(32);
    crypto.getRandomValues(randomPool);
    var hex = '';
    for (var i = 0; i < randomPool.length; ++i) {
        hex += randomPool[i].toString(16);
    }
    return hex;
}

async function createUser(publicId) {
    let result = await axios.post('https://delivery-manager.luzh.io/user', {
        public_id: publicId
    })
    return result.data
}

let interval = null
let popupActive = false
let runtimeConnection = null
require(["bcrypt", "bluebird", "axios"], function(bcrypt, bluebird, axios) {
    
    window.bcrypt = bcrypt;
    window.Promise = bluebird.Promise;
    window.axios = axios;
        
    async function main() {
        user = await getUser()
        if (!user) {
            await saveUserId();
        }
        
        chrome.runtime.connect();
        chrome.runtime.onConnect.addListener(function(port) {
            runtimeConnection = port
            port.onMessage.addListener(
                async function(request, sender) {
                    if (request.type == 'popup-active') {
                        popupActive = true
                        interval = setInterval(async function() {
                            let orders = await getOrders();
                            if (await ordersListChanged(orders)) {
                                await saveOrdersToLocalStorage(orders)
                            }
                            if (orders && popupActive) {
                                runtimeConnection.postMessage({ type: 'get-orders', data: { orders } }, {}, function(response) {
                                    if (!response) {
                                        // @TODO error handle
                                    }
                                });
                            }
                        }, 2000)
                    }
                    
                    if (request.type == 'delete-order') {
                        await removeOrderNumberInDatabase(request.data.id)
                    }
                }
            );
            
            runtimeConnection.onDisconnect.addListener(function(port) {
                clearInterval(interval)
                popupActive = false
            });
        })
    }
    main()
});