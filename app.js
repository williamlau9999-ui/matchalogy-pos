import { initializeApp }
from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";

import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  getDoc,
  deleteDoc,
  doc,
  updateDoc,
  query,
  orderBy
}
from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";


// 🔥 FIREBASE CONFIG
const firebaseConfig = {
  apiKey: "AIzaSyD1ggANpmGObfPNaD0aFK9ZdM_hvyEFh2A",
  authDomain: "matchalogy--pos.firebaseapp.com",
  projectId: "matchalogy--pos",
  storageBucket: "matchalogy--pos.firebasestorage.app",
  messagingSenderId: "409490156449",
  appId: "1:409490156449:web:b7583414b5c16dca9f39e0",
  measurementId: "G-M6CY1YCQCT"
};


const app = initializeApp(firebaseConfig);
const db = getFirestore(app);


let cart = [];
let editingId = null;
let currentCategory = "all";
let selectedProduct = null;
let sortableInstance = null;
let allClosings = [];
let fullMonthSales = {};
let fullAllTimeSales = {};


// ---------- HELPERS ----------

function $(id){
  return document.getElementById(id);
}

function getValue(id){
  return $(id) ? $(id).value : "";
}

function setValue(id,value){
  if($(id)){
    $(id).value = value ?? "";
  }
}

function setText(id,value){
  if($(id)){
    $(id).innerText = value;
  }
}

function setHTML(id,value){
  if($(id)){
    $(id).innerHTML = value;
  }
}

function show(id){
  if($(id)){
    $(id).style.display = "flex";
  }
}

function hide(id){
  if($(id)){
    $(id).style.display = "none";
  }
}

function escapeHTML(value){
  return String(value ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

function toDate(value){

  if(!value){
    return new Date();
  }

  if(value.seconds){
    return new Date(value.seconds * 1000);
  }

  if(value.toDate){
    return value.toDate();
  }

  return new Date(value);

}

function money(value){
  return (Number(value) || 0).toFixed(2);
}

function getModifierHTML(item){

  const main =
    [
      item.milk,
      item.ice,
      item.sweet
    ]
    .filter(Boolean)
    .join(" · ");

  let html = "";

  if(main){
    html += main;
  }

  if(
    item.addon
    &&
    item.addon !== "None"
  ){
    html += `${html ? "<br>" : ""}${escapeHTML(item.addon)}`;
  }

  if(item.note){
    html += `${html ? "<br>" : ""}Note: ${escapeHTML(item.note)}`;
  }

  return html;

}


// ---------- PRODUCTS ----------

async function loadProducts(){

  const snapshot =
    await getDocs(collection(db,"products"));

  let productList = [];

  snapshot.forEach((docSnap)=>{

    productList.push({
      id: docSnap.id,
      ...docSnap.data()
    });

  });

  productList.sort((a,b)=>{

    const sortA =
      Number(a.sort ?? 9999999999999);

    const sortB =
      Number(b.sort ?? 9999999999999);

    return sortA - sortB;

  });

  let html = "";

  productList.forEach((p)=>{

    const category =
      String(p.category || "")
      .toLowerCase();

    if(
      currentCategory !== "all"
      &&
      category !== currentCategory
    ){
      return;
    }

    const price =
      Number(p.price) || 0;

    html += `

      <div
        class="card"
        data-id="${escapeHTML(p.id)}"
        data-name="${escapeHTML(p.name || "")}"
        data-price="${price}"
        data-category="${escapeHTML(p.category || "")}"
        data-modifier="${p.modifierEnabled ? "yes" : "no"}"
        data-default-milk="${escapeHTML(p.defaultMilk || "")}"
        data-default-ice="${escapeHTML(p.defaultIce || "")}"
        data-default-sweet="${escapeHTML(p.defaultSweet || "")}"
        data-default-addon="${escapeHTML(p.defaultAddon || "0")}"
        data-default-note="${escapeHTML(p.defaultNote || "")}"
      >

        <img
          src="${escapeHTML(p.image || "./logo.png")}"
        >

        <div class="card-body">

          <div class="drag-handle">
            ☰
          </div>

          <div class="name">
            ${escapeHTML(p.name || "")}
          </div>

          <div class="price">
            ${escapeHTML(p.category || "Menu")} · RM ${price}
          </div>

          <div class="actions">

            <button
              class="small-btn edit"
              data-id="${escapeHTML(p.id)}"
              data-name="${escapeHTML(p.name || "")}"
              data-price="${price}"
              data-category="${escapeHTML(p.category || "")}"
              data-image="${escapeHTML(p.image || "")}"
              data-modifier="${p.modifierEnabled ? "yes" : "no"}"
              data-default-milk="${escapeHTML(p.defaultMilk || "")}"
              data-default-ice="${escapeHTML(p.defaultIce || "")}"
              data-default-sweet="${escapeHTML(p.defaultSweet || "")}"
              data-default-addon="${escapeHTML(p.defaultAddon || "0")}"
              data-default-note="${escapeHTML(p.defaultNote || "")}"
            >
              Edit
            </button>

            <button
              class="small-btn delete"
              data-delete="${escapeHTML(p.id)}"
            >
              Delete
            </button>

          </div>

        </div>

      </div>

    `;

  });

  setHTML("products",html);

  bindProductClicks();
  bindProductActions();
  initSortable();

}


function bindProductClicks(){

  document.querySelectorAll(".card")
  .forEach((card)=>{

    card.addEventListener("click",(e)=>{

      if(
        e.target.classList.contains("edit")
        ||
        e.target.classList.contains("delete")
        ||
        e.target.classList.contains("drag-handle")
      ){
        return;
      }

      const name =
        card.dataset.name;

      const price =
        Number(card.dataset.price) || 0;

      const modifierEnabled =
        card.dataset.modifier === "yes";

      if(modifierEnabled){

        selectedProduct = {
          name,
          price
        };

        setText("modifierTitle",name);

setValue(
  "milkSelect",
  card.dataset.defaultMilk || ""
);

setValue(
  "iceSelect",
  card.dataset.defaultIce || ""
);

setValue(
  "sweetSelect",
  card.dataset.defaultSweet || ""
);

        setValue(
          "addonSelect",
          card.dataset.defaultAddon || "0"
        );

        setValue(
          "noteInput",
          card.dataset.defaultNote || ""
        );

        show("modifierModal");

      }else{

        addPlainCartItem(name,price);

      }

    });

  });

}


function bindProductActions(){

  document.querySelectorAll("[data-delete]")
  .forEach(btn=>{

    btn.addEventListener("click",async()=>{

      const ok =
        confirm("Delete this product?");

      if(!ok) return;

      await deleteDoc(
        doc(db,"products",btn.dataset.delete)
      );

      loadProducts();

    });

  });


  document.querySelectorAll(".edit")
  .forEach(btn=>{

    btn.addEventListener("click",()=>{

      editingId =
        btn.dataset.id;

      setText(
        "productModalTitle",
        "Edit Product"
      );

      setValue("name",btn.dataset.name);
      setValue("price",btn.dataset.price);
      setValue("category",btn.dataset.category);
      setValue("image",btn.dataset.image);

      setValue(
        "modifierEnabled",
        btn.dataset.modifier || "no"
      );

      setValue(
        "defaultMilk",
        btn.dataset.defaultMilk || ""
      );

      setValue(
        "defaultIce",
        btn.dataset.defaultIce || ""
      );

      setValue(
        "defaultSweet",
        btn.dataset.defaultSweet || ""
      );

      setValue(
        "defaultAddon",
        btn.dataset.defaultAddon || "0"
      );

      setValue(
        "defaultNote",
        btn.dataset.defaultNote || ""
      );

      show("productModal");

    });

  });

}


function initSortable(){

  const productsEl =
    $("products");

  if(
    !productsEl
    ||
    typeof Sortable === "undefined"
  ){
    return;
  }

  if(sortableInstance){
    sortableInstance.destroy();
  }

  sortableInstance =
    new Sortable(
      productsEl,
      {
        handle:".drag-handle",
        animation:150,
        ghostClass:"dragging",

        onEnd: async ()=>{

          const cards =
            document.querySelectorAll(".card");

          for(let i=0;i<cards.length;i++){

            const id =
              cards[i].dataset.id;

            await updateDoc(
              doc(db,"products",id),
              {
                sort:i
              }
            );

          }

        }

      }
    );

}


// ---------- CART ----------

function addPlainCartItem(name,price){

  const existing =
    cart.find(i=>
      i.name === name
      &&
      !i.milk
      &&
      !i.ice
      &&
      !i.sweet
      &&
      !i.addon
      &&
      !i.note
    );

  if(existing){

    existing.qty += 1;

  }else{

    cart.push({
      name,
      price,
      qty:1
    });

  }

  renderCart();

}


function renderCart(){

  let html = "";
  let subtotal = 0;

  cart.forEach((item,index)=>{

    const lineTotal =
      (Number(item.price) || 0)
      *
      (Number(item.qty) || 0);

    subtotal += lineTotal;

    const modifierHTML =
      getModifierHTML(item);

    html += `

      <li>

        <strong>
          ${escapeHTML(item.name)}
        </strong>

        ${modifierHTML ? `
          <br>
          <small>
            ${modifierHTML}
          </small>
        ` : ""}

        <br><br>

        x${item.qty}
        -
        RM${money(lineTotal)}

        <button
          class="remove-btn minus-btn"
          data-index="${index}"
        >
          -
        </button>

        <button
          class="remove-btn plus-btn"
          data-index="${index}"
        >
          +
        </button>

        <button
          class="remove-btn delete-cart-btn"
          data-index="${index}"
        >
          ❌
        </button>

      </li>

    `;

  });

  setHTML("cart",html);

  const discount =
    Number(getValue("discount")) || 0;

  const total =
    Math.max(
      0,
      subtotal - discount
    );

  setText(
    "total",
    money(total)
  );


  document.querySelectorAll(".minus-btn")
  .forEach(btn=>{

    btn.addEventListener("click",()=>{

      const index =
        Number(btn.dataset.index);

      cart[index].qty -= 1;

      if(cart[index].qty <= 0){

        cart.splice(index,1);

      }

      renderCart();

    });

  });


  document.querySelectorAll(".plus-btn")
  .forEach(btn=>{

    btn.addEventListener("click",()=>{

      const index =
        Number(btn.dataset.index);

      cart[index].qty += 1;

      renderCart();

    });

  });


  document.querySelectorAll(".delete-cart-btn")
  .forEach(btn=>{

    btn.addEventListener("click",()=>{

      cart.splice(
        Number(btn.dataset.index),
        1
      );

      renderCart();

    });

  });

}


// ---------- MODIFIER ----------

if($("addModifierBtn")){

  $("addModifierBtn")
  .addEventListener("click",()=>{

    if(!selectedProduct){
      return;
    }

    const milk =
      getValue("milkSelect");

    const ice =
      getValue("iceSelect");

    const sweet =
      getValue("sweetSelect");

    const addonPrice =
      Number(getValue("addonSelect")) || 0;

    const addonSelect =
      $("addonSelect");

    const addonName =
      addonSelect
      ?
      addonSelect.selectedOptions[0].text.trim()
      :
      "None";

    const note =
      getValue("noteInput");

    const finalPrice =
      (Number(selectedProduct.price) || 0)
      +
      addonPrice;

    const existing =
      cart.find(i=>

        i.name === selectedProduct.name
        &&
        i.milk === milk
        &&
        i.ice === ice
        &&
        i.sweet === sweet
        &&
        i.addon === addonName
        &&
        i.note === note
        &&
        Number(i.price) === Number(finalPrice)

      );

    if(existing){

      existing.qty += 1;

    }else{

      cart.push({
        name:selectedProduct.name,
        price:finalPrice,
        qty:1,
        milk,
        ice,
        sweet,
        addon:addonName,
        note
      });

    }

    renderCart();

    hide("modifierModal");

  });

}


// ---------- PRODUCT MODAL + SAVE PRODUCT ----------

if($("openProductBtn")){

  $("openProductBtn")
  .addEventListener("click",()=>{

    editingId = null;

    setText(
      "productModalTitle",
      "Add Product"
    );

    setValue("name","");
    setValue("price","");
    setValue("category","");
    setValue("image","");

    setValue("modifierEnabled","no");
    setValue("defaultMilk","");
    setValue("defaultIce","");
    setValue("defaultSweet","");
    setValue("defaultAddon","0");
    setValue("defaultNote","");

    show("productModal");

  });

}


if($("closeProductBtn")){

  $("closeProductBtn")
  .addEventListener("click",()=>{

    hide("productModal");

  });

}


if($("saveBtn")){

  $("saveBtn")
  .addEventListener("click",async()=>{

    const name =
      getValue("name").trim();

    const price =
      Number(getValue("price"));

    const category =
      getValue("category").trim();

    const image =
      getValue("image").trim();

    const modifierEnabled =
      getValue("modifierEnabled") === "yes";

    const defaultMilk =
      getValue("defaultMilk");

    const defaultIce =
      getValue("defaultIce");

    const defaultSweet =
      getValue("defaultSweet");

    const defaultAddon =
      getValue("defaultAddon") || "0";

    const defaultNote =
      getValue("defaultNote");

    if(
      !name
      ||
      isNaN(price)
    ){

      alert("请填完整商品名称和价格");

      return;

    }

    const productData = {
      name,
      price,
      category,
      image,
      modifierEnabled,
      defaultMilk,
      defaultIce,
      defaultSweet,
      defaultAddon,
      defaultNote
    };

    if(editingId){

      await updateDoc(
        doc(db,"products",editingId),
        productData
      );

      editingId = null;

      alert("Updated ✅");

    }else{

      await addDoc(
        collection(db,"products"),
        {
          ...productData,
          sort: Date.now()
        }
      );

      alert("Added ✅");

    }

    setValue("name","");
    setValue("price","");
    setValue("category","");
    setValue("image","");
    setValue("defaultNote","");

    hide("productModal");

    loadProducts();

  });

}


// ---------- CHECKOUT ----------

if($("clearCartBtn")){

  $("clearCartBtn")
  .addEventListener("click",()=>{

    cart = [];
    renderCart();

  });

}


async function checkout(method){

  if(cart.length === 0){

    alert("Cart empty");

    return;

  }

  const orderNo =
    Date.now()
    .toString()
    .slice(-6);

  const orderNote =
    getValue("orderNote");

  const subtotal =
    cart.reduce(
      (s,i)=>
        s
        +
        (
          (Number(i.price) || 0)
          *
          (Number(i.qty) || 0)
        ),
      0
    );

  const discount =
    Number(getValue("discount")) || 0;

  const total =
    Math.max(
      0,
      subtotal - discount
    );

  const orderData = {
    orderNo,
    items:cart,
    subtotal,
    discount,
    total,
    payment:method,
    note:orderNote,
    time:new Date()
  };

  await addDoc(
    collection(db,"orders"),
    orderData
  );

  showReceipt(orderData);

  cart = [];

  setValue("discount","");
  setValue("orderNote","");

  renderCart();
  loadDashboard();

}


if($("cashBtn")){

  $("cashBtn")
  .addEventListener("click",()=>{

    checkout("Cash");

  });

}


if($("tngBtn")){

  $("tngBtn")
  .addEventListener("click",()=>{

    checkout("TNG");

  });

}


if($("ShopeeBtn")){

  $("ShopeeBtn")
  .addEventListener("click",()=>{

    checkout("Shopee");

  });

}


if($("discount")){

  $("discount")
  .addEventListener("input",()=>{

    renderCart();

  });

}


// ---------- CATEGORY TABS ----------

document.querySelectorAll(".tab")
.forEach(tab=>{

  tab.addEventListener("click",()=>{

    document.querySelectorAll(".tab")
    .forEach(t=>{

      t.classList.remove("active");

    });

    tab.classList.add("active");

    currentCategory =
      tab.dataset.category;

    loadProducts();

  });

});


// ---------- DASHBOARD ----------

function renderTopSelling(data){

  const sorted =
    Object.entries(data)
    .sort((a,b)=>b[1]-a[1])
    .slice(0,3);

  if(sorted.length === 0){
    return "-";
  }

  return sorted
    .map((item,index)=>`
      <div>
        ${index + 1}. ${escapeHTML(item[0])} x${item[1]}
      </div>
    `)
    .join("");

}

function renderFullSales(data){

  const sorted =
    Object.entries(data)
    .sort((a,b)=>b[1]-a[1]);

  if(sorted.length === 0){
    return "<div>No sales data</div>";
  }

  return sorted
    .map((item,index)=>`

      <div class="full-sales-row">

        <span>
          ${index + 1}. ${escapeHTML(item[0])}
        </span>

        <strong>
          x${item[1]}
        </strong>

      </div>

    `)
    .join("");

}


async function loadDashboard(){

  const q =
    query(
      collection(db,"orders"),
      orderBy("time","desc")
    );

  const snapshot =
    await getDocs(q);

  let revenue = 0;
  let count = 0;
  let discountTotal = 0;

  let topToday = {};
  let topMonth = {};
  let topAllTime = {};

  let ordersHTML = "";

  const today =
    new Date().toDateString();

  const now =
    new Date();

  snapshot.forEach((docSnap)=>{

    const order =
      docSnap.data();

    const orderDate =
      toDate(order.time);

    order.items.forEach(item=>{

      topAllTime[item.name] =
        (topAllTime[item.name] || 0)
        +
        (Number(item.qty) || 0);

    });

    if(
      orderDate.getMonth() === now.getMonth()
      &&
      orderDate.getFullYear() === now.getFullYear()
    ){

      order.items.forEach(item=>{

        topMonth[item.name] =
          (topMonth[item.name] || 0)
          +
          (Number(item.qty) || 0);

      });

    }

    if(
      orderDate.toDateString()
      === today
    ){

      revenue +=
        Number(order.total) || 0;

      count += 1;

      discountTotal +=
        Number(order.discount) || 0;

      let itemsHTML = "";

      order.items.forEach(item=>{

        const modifierHTML =
          getModifierHTML(item);

        itemsHTML += `

          <div>
            ${escapeHTML(item.name)} x${item.qty}

            ${modifierHTML ? `
              <small>
                <br>
                ${modifierHTML}
              </small>
            ` : ""}

          </div>

        `;

        topToday[item.name] =
          (topToday[item.name] || 0)
          +
          (Number(item.qty) || 0);

      });

      ordersHTML += `

        <div class="order-card">

          <div
            class="order-header"
            onclick="toggleOrder('${docSnap.id}')"
          >

            <div>
              <span class="order-no">
                ${order.orderNo ? "#" + order.orderNo : ""}
              </span>

              <span class="order-clock">
                ${orderDate.toLocaleTimeString()}
              </span>
            </div>

            <div>
              RM ${money(order.total)}
            </div>

          </div>

          <div
            class="order-details"
            id="order-${docSnap.id}"
          >

            ${itemsHTML}

            <div class="order-payment">

              ${escapeHTML(order.payment || "")}

              ${order.discount > 0
                ? `<br>Discount: RM ${money(order.discount)}`
                : ""
              }

              ${order.note
                ? `<br>Note: ${escapeHTML(order.note)}`
                : ""
              }

            </div>

            <div class="order-actions">

              <button
                onclick="deleteOrder('${docSnap.id}')"
              >
                Delete
              </button>

              <button
                onclick="editOrder('${docSnap.id}')"
              >
                Edit Order
              </button>

            </div>

          </div>

        </div>

      `;

    }

  });

  setText("todayRevenue",money(revenue));
  setText("todayOrders",count);
  setText("todayDiscount",money(discountTotal));

  setHTML("ordersList",ordersHTML);

  setHTML(
    "topSellingToday",
    renderTopSelling(topToday)
  );

  setHTML(
    "topSellingMonth",
    renderTopSelling(topMonth)
  );

  setHTML(
  "topSellingAllTime",
  renderTopSelling(topAllTime)
);

fullMonthSales = topMonth;
fullAllTimeSales = topAllTime;

}


window.toggleOrder = function(id){

  const el =
    $(`order-${id}`);

  if(!el) return;

  el.style.display =
    el.style.display === "block"
    ?
    "none"
    :
    "block";

}


window.deleteOrder = async function(id){

  const ok =
    confirm("Delete order?");

  if(!ok) return;

  await deleteDoc(
    doc(db,"orders",id)
  );

  loadDashboard();

}


window.editOrder = async function(id){

  const orderRef =
    doc(db,"orders",id);

  const orderSnap =
    await getDoc(orderRef);

  const order =
    orderSnap.data();

  let text = "";

  order.items.forEach(item=>{

    text +=
      `${item.name},${item.qty},${item.price}\n`;

  });

  const result =
    prompt(

`Edit Items

Format:
name,qty,price

Example:
Shiro Matcha,2,9.9
Basque,1,14.9
`,

      text

    );

  if(result === null) return;

  const lines =
    result
    .split("\n")
    .filter(line=>line.trim());

  let items = [];
  let subtotal = 0;

  lines.forEach(line=>{

    const parts =
      line.split(",");

    const name =
      parts[0];

    const qty =
      Number(parts[1]);

    const price =
      Number(parts[2]);

    if(
      name
      &&
      !isNaN(qty)
      &&
      !isNaN(price)
    ){

      items.push({
        name,
        qty,
        price
      });

      subtotal +=
        qty * price;

    }

  });

  const discount =
    Number(
      prompt(
        "Discount RM",
        order.discount || 0
      )
    ) || 0;

  const total =
    Math.max(
      0,
      subtotal - discount
    );

  const payment =
    prompt(
      "Payment Method",
      order.payment
    );

  if(payment === null) return;

  const note =
    prompt(
      "Order Note",
      order.note || ""
    );

  if(note === null) return;

  await updateDoc(
    orderRef,
    {
      items,
      subtotal,
      discount,
      total,
      payment,
      note
    }
  );

  loadDashboard();

}


// ---------- RECEIPT ----------

function showReceipt(order){

  const now =
    new Date();

  let html = `

    <div class="receipt">

      <div class="receipt-logo">
        <img src="./logo.png" alt="logo">
      </div>

      <h2>
        Matchalogy
      </h2>

      <p class="receipt-sub">
        Order #${order.orderNo || ""}
      </p>

      <p class="receipt-time">
        ${now.toLocaleString()}
      </p>

      <hr>

  `;

  order.items.forEach(item=>{

    const modifierHTML =
      getModifierHTML(item);

    html += `

      <div class="receipt-item">

        <div>

          <strong>
            ${escapeHTML(item.name)}
          </strong>

          ${modifierHTML ? `
            <small>
              ${modifierHTML}
            </small>
          ` : ""}

        </div>

        <div>
          x${item.qty}
          <br>
          RM ${money((Number(item.price) || 0) * (Number(item.qty) || 0))}
        </div>

      </div>

    `;

  });

  html += `

      <hr>

      ${order.discount > 0 ? `

        <div class="receipt-total">
          <span>Discount</span>
          <strong>- RM ${money(order.discount)}</strong>
        </div>

      ` : ""}

      <div class="receipt-total">
        <span>Total</span>
        <strong>RM ${money(order.total)}</strong>
      </div>

      <p class="receipt-payment">
        Payment: ${escapeHTML(order.payment || "")}
      </p>

      ${order.note ? `

        <p>
          Note: ${escapeHTML(order.note)}
        </p>

      ` : ""}

      <p class="receipt-thanks">
        Thank you for visiting 💚
      </p>

    </div>

  `;

  setHTML("receiptContent",html);

  show("receiptModal");

}


if($("closeReceiptBtn")){

  $("closeReceiptBtn")
  .addEventListener("click",()=>{

    hide("receiptModal");

  });

}


if($("printReceiptBtn")){

  $("printReceiptBtn")
  .addEventListener("click",()=>{

    window.print();

  });

}


// ---------- CLOSING ----------

if($("closeDayBtn")){

  $("closeDayBtn")
  .addEventListener("click",async()=>{

    const ok =
      confirm("Close today?");

    if(!ok) return;

    const today =
      new Date().toDateString();

    const snapshot =
      await getDocs(collection(db,"orders"));

    let revenue = 0;
    let discount = 0;
    let orders = 0;

    let cash = 0;
    let tng = 0;
    let shopee = 0;

    snapshot.forEach((docSnap)=>{

      const order =
        docSnap.data();

      const orderDate =
        toDate(order.time)
        .toDateString();

      if(orderDate === today){

        const total =
          Number(order.total) || 0;

        revenue += total;

        discount +=
          Number(order.discount) || 0;

        orders += 1;

        if(order.payment === "Cash"){
          cash += total;
        }

        if(order.payment === "TNG"){
          tng += total;
        }

        if(order.payment === "Shopee"){
          shopee += total;
        }

      }

    });

    await addDoc(
      collection(db,"closings"),
      {
        date: today,
        revenue,
        discount,
        orders,
        cash,
        tng,
        shopee,
        time:new Date()
      }
    );

    alert("Day Closed ✅");

    loadClosingHistory();

  });

}


function renderClosingCards(list){

  let html = "";

  list.forEach(c=>{

    html += `

      <div class="closing-card">

        <strong>
          ${escapeHTML(c.date)}
        </strong>

        Revenue: RM ${money(c.revenue)}
        <br>

        Discount: RM ${money(c.discount)}
        <br>

        Orders: ${c.orders}
        <br>

        Cash: RM ${money(c.cash)}
        <br>

        TNG: RM ${money(c.tng)}
        <br>

        Shopee: RM ${money(c.shopee)}

        <button onclick="deleteClosing('${c.id}')">
          Delete
        </button>

      </div>

    `;

  });

  return html;

}


async function loadClosingHistory(){

  const snapshot =
    await getDocs(collection(db,"closings"));

  let closings = [];

  snapshot.forEach((docSnap)=>{

    closings.push({
      id:docSnap.id,
      ...docSnap.data()
    });

  });

  closings.sort((a,b)=>{

    return toDate(b.time) - toDate(a.time);

  });

  allClosings = closings;

  let monthData = {};

  closings.forEach(c=>{

    const date =
      toDate(c.time);

    const monthKey =
      `${date.toLocaleString("default",{
        month:"long"
      })} ${date.getFullYear()}`;

    if(!monthData[monthKey]){
      monthData[monthKey] = 0;
    }

    monthData[monthKey] +=
      Number(c.revenue) || 0;

  });

  let monthHTML = "";

  Object.entries(monthData)
  .forEach(([month,total])=>{

    monthHTML += `

      <div class="closing-card">

        <strong>${escapeHTML(month)}</strong>

        Revenue:
        RM ${money(total)}

      </div>

    `;

  });

  setHTML("monthlyRevenue",monthHTML);

  setHTML(
    "closingHistory",
    renderClosingCards(closings)
  );

}


if($("closingSearch")){

  $("closingSearch")
  .addEventListener("input",()=>{

    const keyword =
      getValue("closingSearch")
      .toLowerCase();

    const filtered =
      allClosings.filter(c=>
        String(c.date)
        .toLowerCase()
        .includes(keyword)
      );

    setHTML(
      "closingHistory",
      renderClosingCards(filtered)
    );

  });

}


window.deleteClosing = async function(id){

  const ok =
    confirm("Delete this closing record?");

  if(!ok) return;

  await deleteDoc(
    doc(db,"closings",id)
  );

  loadClosingHistory();

}


if($("openMonthlyBtn")){

  $("openMonthlyBtn")
  .addEventListener("click",()=>{

    show("monthlyModal");

  });

}


if($("closeMonthlyBtn")){

  $("closeMonthlyBtn")
  .addEventListener("click",()=>{

    hide("monthlyModal");

  });

}


// ---------- START ----------

if($("openSalesBtn")){

  $("openSalesBtn")
  .addEventListener("click",()=>{

    setHTML(
      "allSalesList",
      renderFullSales(fullMonthSales)
    );

    $("showMonthSalesBtn")
      .classList.add("active");

    $("showAllSalesBtn")
      .classList.remove("active");

    show("salesModal");

  });

}


if($("showMonthSalesBtn")){

  $("showMonthSalesBtn")
  .addEventListener("click",()=>{

    setHTML(
      "allSalesList",
      renderFullSales(fullMonthSales)
    );

    $("showMonthSalesBtn")
      .classList.add("active");

    $("showAllSalesBtn")
      .classList.remove("active");

  });

}


if($("showAllSalesBtn")){

  $("showAllSalesBtn")
  .addEventListener("click",()=>{

    setHTML(
      "allSalesList",
      renderFullSales(fullAllTimeSales)
    );

    $("showAllSalesBtn")
      .classList.add("active");

    $("showMonthSalesBtn")
      .classList.remove("active");

  });

}


if($("closeSalesBtn")){

  $("closeSalesBtn")
  .addEventListener("click",()=>{

    hide("salesModal");

  });

}

loadProducts();
loadDashboard();
loadClosingHistory();