import {
  initializeApp
}
from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";

import {
  getFirestore,
  collection,
  addDoc,
  doc,
  onSnapshot,
  serverTimestamp
}
from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

import {
  getAuth,
  signInAnonymously
}
from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";


const firebaseConfig = {
  apiKey: "AIzaSyD1ggANpmGObfPNaD0aFK9ZdM_hvyEFh2A",
  authDomain: "matchalogy--pos.firebaseapp.com",
  projectId: "matchalogy--pos",
  storageBucket: "matchalogy--pos.firebasestorage.app",
  messagingSenderId: "409490156449",
  appId: "1:409490156449:web:b7583414b5c16dca9f39e0"
};


const app =
  initializeApp(firebaseConfig);

const db =
  getFirestore(app);

const auth =
  getAuth(app);


const ADDONS = {
  "0":{
    name:"None",
    price:0
  },
  "2":{
    name:"Extra Shot +RM2",
    price:2
  },
  "3":{
    name:"Matcha Foam +RM3",
    price:3
  }
};


let products = [];
let cart = loadSavedCart();
let selectedProduct = null;
let currentCategory = "all";
let currentUser = null;
let submitting = false;
let storeOpen = true;
let orderStatusUnsubscribe = null;


function $(id){
  return document.getElementById(id);
}


function escapeHTML(value){

  return String(value ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");

}


function money(value){

  return (
    Number(value) || 0
  ).toFixed(2);

}


function safeText(
  value,
  maximumLength = 200
){

  return String(value ?? "")
    .trim()
    .slice(0,maximumLength);

}


function showModal(id){

  if($(id)){
    $(id).style.display = "flex";
  }

}


function hideModal(id){

  if($(id)){
    $(id).style.display = "none";
  }

}


function loadSavedCart(){

  try{

    const saved =
      localStorage.getItem(
        "matchalogyCustomerCart"
      );

    const parsed =
      JSON.parse(saved || "[]");

    return Array.isArray(parsed)
      ? parsed
      : [];

  }catch(error){

    return [];

  }

}


function saveCart(){

  localStorage.setItem(
    "matchalogyCustomerCart",
    JSON.stringify(cart)
  );

}


function getAddon(code){

  return ADDONS[String(code)]
    || ADDONS["0"];

}


function getModifierText(item){

  const firstLine = [
    item.milk,
    item.ice,
    item.sweet
  ]
  .filter(Boolean)
  .map(escapeHTML)
  .join(" · ");

  const lines = [];

  if(firstLine){
    lines.push(firstLine);
  }

  if(
    item.addon
    &&
    item.addon !== "None"
  ){
    lines.push(
      escapeHTML(item.addon)
    );
  }

  if(item.note){

    lines.push(
      `Note: ${escapeHTML(item.note)}`
    );

  }

  return lines.join("<br>");

}


async function authenticateCustomer(){

  if(auth.currentUser){

    currentUser =
      auth.currentUser;

    return;

  }

  const credential =
    await signInAnonymously(auth);

  currentUser =
    credential.user;

}


function listenStoreStatus(){

  onSnapshot(
    doc(db,"settings","store"),
    snapshot=>{

      if(!snapshot.exists()){

        storeOpen = true;

      }else{

        storeOpen =
          snapshot.data().open !== false;

      }

      updateStoreStatus();

      renderCustomerProducts();

    },
    error=>{

      console.error(error);

      storeOpen = false;

      updateStoreStatus();

    }
  );

}


function updateStoreStatus(){

  const banner =
    $("storeStatusBanner");

  if(!banner){
    return;
  }

  banner.classList.remove(
    "open",
    "closed"
  );

  if(storeOpen){

    banner.classList.add("open");

    banner.innerText =
      "Open · Orders available";

  }else{

    banner.classList.add("closed");

    banner.innerText =
      "Currently closed · Ordering unavailable";

  }

}


function listenCustomerProducts(){

  onSnapshot(
    collection(db,"products"),
    snapshot=>{

      products = [];

      snapshot.forEach(docSnap=>{

        products.push({
          id:docSnap.id,
          ...docSnap.data()
        });

      });

      products.sort((a,b)=>

        Number(
          a.sort ?? 9999999999999
        )
        -
        Number(
          b.sort ?? 9999999999999
        )

      );

      refreshCartPrices();

      renderCustomerProducts();
      renderCustomerCart();

    },
    error=>{

      console.error(error);

      $("customerProducts").innerHTML = `
        <div class="empty-state">
          Unable to load menu.
        </div>
      `;

    }
  );

}


function refreshCartPrices(){

  const productMap =
    new Map(
      products.map(product=>
        [product.id,product]
      )
    );

  cart =
    cart.filter(item=>{

      const product =
        productMap.get(item.productId);

      if(!product){
        return false;
      }

      if(product.available === false){
        return false;
      }

      const addon =
        getAddon(item.addonCode);

      item.name =
        product.name || item.name;

      item.basePrice =
        Number(product.price) || 0;

      item.price =
        item.basePrice
        +
        addon.price;

      item.addon =
        addon.name;

      return true;

    });

  saveCart();

}


function renderCustomerProducts(){

  const visibleProducts =
    products.filter(product=>{

      if(currentCategory === "all"){
        return true;
      }

      return String(
        product.category || ""
      ).toLowerCase()
      ===
      currentCategory;

    });


  if(visibleProducts.length === 0){

    $("customerProducts").innerHTML = `
      <div class="empty-state">
        No products available.
      </div>
    `;

    return;

  }


  $("customerProducts").innerHTML =
    visibleProducts
    .map(product=>{

      const available =
        product.available !== false;

      const canOrder =
        storeOpen && available;

      return `

        <article class="customer-product">

          <img
            src="${escapeHTML(
              product.image || "./logo.png"
            )}"
            alt="${escapeHTML(
              product.name || ""
            )}"
          >

          <div class="customer-product-body">

            <div class="customer-product-name">
              ${escapeHTML(product.name || "")}
            </div>

            <div class="customer-product-category">
              ${escapeHTML(
                product.category || "Menu"
              )}
            </div>

            <div class="customer-product-price">
              RM ${money(product.price)}
            </div>

            <button
              class="customer-add-product"
              data-product-id="${product.id}"
              ${canOrder ? "" : "disabled"}
            >
              ${
                !storeOpen
                ? "Closed"
                : available
                  ? "Add"
                  : "Sold Out"
              }
            </button>

          </div>

        </article>

      `;

    })
    .join("");


  document
  .querySelectorAll(
    ".customer-add-product"
  )
  .forEach(button=>{

    button.addEventListener(
      "click",
      ()=>{

        if(button.disabled){
          return;
        }

        const product =
          products.find(
            item=>
              item.id
              ===
              button.dataset.productId
          );

        if(product){
          selectCustomerProduct(product);
        }

      }
    );

  });

}


function setSelectValue(id,value){

  const element = $(id);

  if(!element){
    return;
  }

  const exists =
    [...element.options]
    .some(option=>
      option.value === value
    );

  element.value =
    exists ? value : "";

}


function selectCustomerProduct(product){

  if(
    !storeOpen
    ||
    product.available === false
  ){
    return;
  }

  if(product.modifierEnabled !== true){

    addPlainItem(product);

    return;

  }

  selectedProduct =
    product;

  $("customerModifierTitle").innerText =
    product.name || "Product";

  setSelectValue(
    "customerMilk",
    product.defaultMilk || ""
  );

  setSelectValue(
    "customerIce",
    product.defaultIce || ""
  );

  setSelectValue(
    "customerSweet",
    product.defaultSweet || ""
  );

  setSelectValue(
    "customerAddon",
    product.defaultAddon || "0"
  );

  $("customerItemNote").value =
    safeText(
      product.defaultNote,
      200
    );

  showModal(
    "customerModifierModal"
  );

}


function addPlainItem(product){

  const existing =
    cart.find(item=>

      item.productId === product.id
      &&
      !item.milk
      &&
      !item.ice
      &&
      !item.sweet
      &&
      !item.addonCode
      &&
      !item.note

    );

  if(existing){

    if(existing.qty < 20){
      existing.qty += 1;
    }

  }else{

    cart.push({
      productId:product.id,
      name:product.name,
      basePrice:
        Number(product.price) || 0,
      price:
        Number(product.price) || 0,
      qty:1,
      milk:"",
      ice:"",
      sweet:"",
      addonCode:"0",
      addon:"None",
      note:""
    });

  }

  saveCart();
  renderCustomerCart();

}


function renderCustomerCart(){

  let quantity = 0;
  let total = 0;

  cart.forEach(item=>{

    quantity +=
      Number(item.qty) || 0;

    total +=
      (
        Number(item.price) || 0
      )
      *
      (
        Number(item.qty) || 0
      );

  });

  $("cartCount").innerText =
    quantity;

  $("floatingTotal").innerText =
    money(total);

  $("customerTotal").innerText =
    money(total);


  if(cart.length === 0){

    $("customerCartList").innerHTML = `
      <div class="empty-state">
        Your cart is empty.
      </div>
    `;

    return;

  }


  $("customerCartList").innerHTML =
    cart.map((item,index)=>{

      const modifier =
        getModifierText(item);

      return `

        <div class="customer-cart-item">

          <div class="customer-cart-top">

            <div>

              <div class="customer-cart-name">
                ${escapeHTML(item.name)}
              </div>

              ${modifier ? `

                <div class="customer-cart-modifier">
                  ${modifier}
                </div>

              ` : ""}

            </div>

            <strong>
              RM ${money(
                item.price * item.qty
              )}
            </strong>

          </div>

          <div class="customer-cart-bottom">

            <span>
              RM ${money(item.price)} each
            </span>

            <div class="customer-cart-controls">

              <button
                class="customer-minus"
                data-index="${index}"
              >
                −
              </button>

              <strong>
                ${item.qty}
              </strong>

              <button
                class="customer-plus"
                data-index="${index}"
              >
                +
              </button>

              <button
                class="remove-customer-item"
                data-index="${index}"
              >
                ×
              </button>

            </div>

          </div>

        </div>

      `;

    }).join("");


  bindCartControls();

}


function bindCartControls(){

  document
  .querySelectorAll(".customer-minus")
  .forEach(button=>{

    button.addEventListener(
      "click",
      ()=>{

        const index =
          Number(button.dataset.index);

        cart[index].qty -= 1;

        if(cart[index].qty <= 0){
          cart.splice(index,1);
        }

        saveCart();
        renderCustomerCart();

      }
    );

  });


  document
  .querySelectorAll(".customer-plus")
  .forEach(button=>{

    button.addEventListener(
      "click",
      ()=>{

        const index =
          Number(button.dataset.index);

        if(cart[index].qty < 20){
          cart[index].qty += 1;
        }

        saveCart();
        renderCustomerCart();

      }
    );

  });


  document
  .querySelectorAll(
    ".remove-customer-item"
  )
  .forEach(button=>{

    button.addEventListener(
      "click",
      ()=>{

        cart.splice(
          Number(button.dataset.index),
          1
        );

        saveCart();
        renderCustomerCart();

      }
    );

  });

}


$("customerAddModifierBtn")
.addEventListener("click",()=>{

  if(!selectedProduct){
    return;
  }

  const milk =
    safeText(
      $("customerMilk").value,
      40
    );

  const ice =
    safeText(
      $("customerIce").value,
      40
    );

  const sweet =
    safeText(
      $("customerSweet").value,
      40
    );

  const addonCode =
    String(
      $("customerAddon").value || "0"
    );

  const addon =
    getAddon(addonCode);

  const note =
    safeText(
      $("customerItemNote").value,
      200
    );

  const basePrice =
    Number(selectedProduct.price) || 0;

  const finalPrice =
    basePrice + addon.price;

  const existing =
    cart.find(item=>

      item.productId
      ===
      selectedProduct.id

      && item.milk === milk
      && item.ice === ice
      && item.sweet === sweet
      && item.addonCode === addonCode
      && item.note === note

    );

  if(existing){

    if(existing.qty < 20){
      existing.qty += 1;
    }

  }else{

    cart.push({
      productId:selectedProduct.id,
      name:selectedProduct.name,
      basePrice,
      price:finalPrice,
      qty:1,
      milk,
      ice,
      sweet,
      addonCode,
      addon:addon.name,
      note
    });

  }

  selectedProduct = null;

  hideModal(
    "customerModifierModal"
  );

  saveCart();
  renderCustomerCart();

});


function listenToSubmittedOrder(
  orderRef
){

  if(orderStatusUnsubscribe){
    orderStatusUnsubscribe();
  }

  orderStatusUnsubscribe =
    onSnapshot(
      orderRef,
      snapshot=>{

        if(!snapshot.exists()){
          return;
        }

        const order =
          snapshot.data();

        const status =
          order.status || "pending";

        const statusElement =
          $("customerOrderStatus");

        const detailElement =
          $("customerOrderStatusDetail");

        statusElement.classList.remove(
          "pending",
          "accepted",
          "rejected"
        );

        statusElement.classList.add(
          status
        );

        if(status === "pending"){

          statusElement.innerText =
            "Waiting for shop confirmation";

          detailElement.innerText =
            "Please keep this page open or show your QR order number at the counter.";

        }

        if(status === "accepted"){

          statusElement.innerText =
            "Order accepted";

          detailElement.innerText =
            order.officialOrderNo
            ?
            `Official order #${order.officialOrderNo}`
            :
            "Please proceed to payment at the counter.";

        }

        if(status === "rejected"){

          statusElement.innerText =
            "Order unavailable";

          detailElement.innerText =
            order.rejectReason
            ||
            "Please speak to our staff.";

        }

      }
    );

}


async function submitCustomerOrder(){

  if(submitting){
    return;
  }

  if(!currentUser){

    alert(
      "Connecting to ordering system. Please try again."
    );

    return;

  }

  if(!storeOpen){

    alert("The store is currently closed.");

    return;

  }

  if(cart.length === 0){

    alert("Your cart is empty.");

    return;

  }

  if(cart.length > 30){

    alert(
      "Too many different items in one order."
    );

    return;

  }

  const customerName =
    safeText(
      $("customerName").value,
      50
    );

  if(!customerName){

    alert("Please enter your pickup name.");

    $("customerName").focus();

    return;

  }

  const customerPhone =
    safeText(
      $("customerPhone").value,
      30
    );

  const orderNote =
    safeText(
      $("customerOrderNote").value,
      300
    );


  const orderItems =
    cart.map(item=>({

      productId:
        String(item.productId),

      nameSnapshot:
        safeText(item.name,100),

      qty:
        Math.min(
          20,
          Math.max(
            1,
            Number(item.qty) || 1
          )
        ),

      milk:
        safeText(item.milk,40),

      ice:
        safeText(item.ice,40),

      sweet:
        safeText(item.sweet,40),

      addonCode:
        String(item.addonCode || "0"),

      addonName:
        safeText(item.addon,80),

      note:
        safeText(item.note,200),

      estimatedUnitPrice:
        Number(item.price) || 0

    }));


  const estimatedTotal =
    orderItems.reduce(
      (sum,item)=>

        sum
        +
        (
          item.estimatedUnitPrice
          *
          item.qty
        ),

      0
    );


  const customerOrderNo =
    `QR${Date.now()
      .toString()
      .slice(-6)}`;


  submitting = true;

  const button =
    $("submitCustomerOrderBtn");

  button.disabled = true;
  button.innerText = "Submitting...";


  try{

    const orderRef =
      await addDoc(
        collection(db,"pendingOrders"),
        {
          creatorUid:
            currentUser.uid,

          customerOrderNo,

          customerName,

          customerPhone,

          note:orderNote,

          items:orderItems,

          estimatedTotal,

          source:"QR",

          status:"pending",

          createdAt:
            serverTimestamp()
        }
      );


    hideModal(
      "customerCartModal"
    );

    $("customerOrderNumber").innerText =
      customerOrderNo;

    $("customerOrderStatus").innerText =
      "Waiting for shop confirmation";

    $("customerOrderStatus")
      .className =
        "customer-order-status pending";

    $("customerOrderStatusDetail")
      .innerText =
        "Please pay at the counter after the order is accepted.";

    showModal(
      "orderSuccessModal"
    );


    listenToSubmittedOrder(
      orderRef
    );


    cart = [];

    saveCart();

    $("customerName").value = "";
    $("customerPhone").value = "";
    $("customerOrderNote").value = "";

    renderCustomerCart();


  }catch(error){

    console.error(error);

    alert(
      "Unable to submit order. Please try again."
    );

  }finally{

    submitting = false;

    button.disabled = false;
    button.innerText = "Submit Order";

  }

}


document
.querySelectorAll(".category-tab")
.forEach(tab=>{

  tab.addEventListener(
    "click",
    ()=>{

      document
      .querySelectorAll(".category-tab")
      .forEach(item=>
        item.classList.remove("active")
      );

      tab.classList.add("active");

      currentCategory =
        tab.dataset.category;

      renderCustomerProducts();

    }
  );

});


$("openCartBtn")
.addEventListener(
  "click",
  ()=>showModal("customerCartModal")
);

$("closeCartBtn")
.addEventListener(
  "click",
  ()=>hideModal("customerCartModal")
);

$("closeModifierBtn")
.addEventListener(
  "click",
  ()=>hideModal("customerModifierModal")
);

$("closeSuccessBtn")
.addEventListener(
  "click",
  ()=>hideModal("orderSuccessModal")
);

$("submitCustomerOrderBtn")
.addEventListener(
  "click",
  submitCustomerOrder
);


async function startCustomerApp(){

  try{

    await authenticateCustomer();

    renderCustomerCart();

    listenStoreStatus();

    listenCustomerProducts();

  }catch(error){

    console.error(error);

    alert(
      "Unable to connect to the ordering system."
    );

  }

}


startCustomerApp();