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


// LOAD PRODUCTS
async function loadProducts(){

  const q = query(
    collection(db,"products"),
    orderBy("sort")
  );

  const snapshot =
    await getDocs(q);

  let html = "";

  snapshot.forEach((docSnap)=>{

    const p = docSnap.data();

    if(
      currentCategory !== "all"
      &&
      p.category?.toLowerCase()
      !== currentCategory
    ){
      return;
    }

    html += `

      <div
        class="card"
        data-id="${docSnap.id}"
      >

        <img
          src="${p.image || 'https://picsum.photos/300'}"
        >

        <div class="card-body">

<div class="drag-handle">
☰
</div>

          <div class="name">
            ${p.name}
          </div>

          <div class="price">
            ${p.category || "Menu"} · RM ${p.price}
          </div>

          <div class="actions">

            <button
              class="small-btn edit"
              data-id="${docSnap.id}"
              data-name="${p.name}"
              data-price="${p.price}"
              data-category="${p.category || ''}"
              data-image="${p.image || ''}"
            >
              Edit
            </button>

            <button
              class="small-btn delete"
              data-delete="${docSnap.id}"
            >
              Delete
            </button>

          </div>

        </div>

      </div>

    `;
  });

  document.getElementById("products")
    .innerHTML = html;


  // ADD TO CART
  document.querySelectorAll(".card")
    .forEach((card,index)=>{

     card.addEventListener("click",(e)=>{

  if(
    e.target.classList.contains("drag-handle")
  ){
    return;
  }

  if(
    e.target.classList.contains("edit")
    ||
    e.target.classList.contains("delete")
  ){
    return;
  }

        const current =
          document.querySelectorAll(".card")[index];

        const name =
          current.querySelector(".name")
          .innerText;

        const priceText =
          current.querySelector(".price")
          .innerText;

        const price =
          parseFloat(
            priceText.split("RM ")[1]
          );

        const category =
  current.querySelector(".price")
  .innerText
  .split("·")[0]
  .trim()
  .toLowerCase();

if(
  category === "matcha"
  ||
  category === "espresso"
){

  selectedProduct = {
    name,
    price
  };

  document.getElementById(
    "modifierTitle"
  ).innerText = name;

  document.getElementById(
    "modifierModal"
  ).style.display = "flex";

}else{

  const existing =
    cart.find(i=>
      i.name === name &&
      !i.milk &&
      !i.ice
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

      });

    });


  // DELETE PRODUCT
  document.querySelectorAll("[data-delete]")
    .forEach(btn=>{

      btn.addEventListener("click",async()=>{

        await deleteDoc(
          doc(
            db,
            "products",
            btn.dataset.delete
          )
        );

        loadProducts();

      });

    });


  // EDIT PRODUCT
  document.querySelectorAll(".edit")
    .forEach(btn=>{

      btn.addEventListener("click",()=>{

        editingId = btn.dataset.id;

        document.getElementById("name")
          .value = btn.dataset.name;

        document.getElementById("price")
          .value = btn.dataset.price;

        document.getElementById("category")
          .value = btn.dataset.category;

        document.getElementById("image")
          .value = btn.dataset.image;

      });

    });


  // DRAG SORT

}


// RENDER CART
function renderCart(){

  let html = "";

  let total = 0;

  cart.forEach((item,index)=>{

    total += item.price * item.qty;

    html += `

      <li>

     ${item.name}

<br>

<small>

${item.milk ? item.milk + " · " : ""}
${item.ice ? item.ice + " · " : ""}
${item.sweet ? item.sweet : ""}
${item.addon && item.addon !== "None" ? "<br>" + item.addon : ""}
${item.note ? "<br>Note: " + item.note : ""}

</small>

x${item.qty}
        - RM${(item.price * item.qty).toFixed(2)}

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

  document.getElementById("cart")
    .innerHTML = html;

  document.getElementById("total")
    .innerText = total.toFixed(2);


  // MINUS
  document.querySelectorAll(".minus-btn")
    .forEach(btn=>{

      btn.addEventListener("click",()=>{

        const index =
          btn.dataset.index;

        cart[index].qty -= 1;

        if(cart[index].qty <= 0){

          cart.splice(index,1);

        }

        renderCart();

      });

    });


  // PLUS
  document.querySelectorAll(".plus-btn")
    .forEach(btn=>{

      btn.addEventListener("click",()=>{

        const index =
          btn.dataset.index;

        cart[index].qty += 1;

        renderCart();

      });

    });


  // DELETE CART
  document.querySelectorAll(".delete-cart-btn")
    .forEach(btn=>{

      btn.addEventListener("click",()=>{

        cart.splice(
          btn.dataset.index,
          1
        );

        renderCart();

      });

    });

}


// SAVE PRODUCT
document.getElementById("saveBtn")
.addEventListener("click",async()=>{

  const name =
    document.getElementById("name").value;

  const price =
    parseFloat(
      document.getElementById("price").value
    );

  const category =
    document.getElementById("category").value;

  const image =
    document.getElementById("image").value;

  if(!name || isNaN(price)){

    alert("请填完整");

    return;

  }

  if(editingId){

    await updateDoc(
      doc(db,"products",editingId),
      {
        name,
        price,
        category,
        image
      }
    );

    editingId = null;

    alert("Updated ✅");

  }else{

    await addDoc(
      collection(db,"products"),
      {
        name,
        price,
        category,
        image,
        sort: Date.now()
      }
    );

    alert("Added ✅");

  }

  document.getElementById("name").value = "";

  document.getElementById("price").value = "";

  document.getElementById("category").value = "";

  document.getElementById("image").value = "";

  loadProducts();

});


// CLEAR CART
document.getElementById("clearCartBtn")
.addEventListener("click",()=>{

  cart = [];

  renderCart();

});


// CHECKOUT
async function checkout(method){

  if(cart.length === 0){

    alert("Cart empty");

    return;

  }

  const subtotal =

  cart.reduce(
    (s,i)=>s+(i.price*i.qty),
    0
  );

const discount =

  Number(
    document.getElementById("discount")
    .value
  ) || 0;

const orderNote =
  document.getElementById("orderNote").value;

const total =

  subtotal - discount;

const orderNo =
  Date.now().toString().slice(-6);

  await addDoc(
  collection(db,"orders"),
  {
  orderNo,
  items:cart,
  subtotal,
  discount,
  total,
  payment:method,
  note:orderNote,
  time:new Date()
  }
);

showReceipt({
  orderNo,
  items: cart,
  subtotal,
  discount,
  total,
  payment: method,
  note: orderNote
});

alert("Order Done ✅");
 
document.getElementById("orderNote").value = "";

cart = [];
renderCart();
loadDashboard();

}


// PAYMENT
document.getElementById("cashBtn")
.addEventListener("click",()=>{

  checkout("Cash");

});

document.getElementById("tngBtn")
.addEventListener("click",()=>{

  checkout("TNG");

});

document.getElementById("ShopeeBtn")
.addEventListener("click",()=>{

  checkout("Shopee");

});


// CATEGORY TAB
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


// DASHBOARD
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
        ${index + 1}. ${item[0]} x${item[1]}
      </div>
    `)
    .join("");

}

async function loadDashboard(){


  const q = query(
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

order.items.forEach(item=>{

  topAllTime[item.name] =
    (topAllTime[item.name] || 0) + item.qty;

});

    const orderDate =
      new Date(
        order.time.seconds * 1000
      );

    // ✅ This Month Top Selling
    if(
      orderDate.getMonth() === now.getMonth()
      &&
      orderDate.getFullYear() === now.getFullYear()
    ){

      order.items.forEach(item=>{

        topMonth[item.name] =
          (topMonth[item.name] || 0) + item.qty;

      });

    }

    // ✅ Today Dashboard
    if(
      orderDate.toDateString()
      === today
    ){

      revenue += order.total;

      count += 1;

      discountTotal +=
        order.discount || 0;

      order.items.forEach(item=>{

        topToday[item.name] =
          (topToday[item.name] || 0) + item.qty;

      });

      let itemsHTML = "";

      order.items.forEach(item=>{

       itemsHTML += `
  <div>
    ${item.name} x${item.qty}

    ${item.milk || item.ice || item.sweet || item.addon || item.note ? `
      <small>
        <br>
        ${item.milk ? item.milk + " · " : ""}
        ${item.ice ? item.ice + " · " : ""}
        ${item.sweet ? item.sweet : ""}
        ${item.addon && item.addon !== "None" ? "<br>" + item.addon : ""}
        ${item.note ? "<br>Note: " + item.note : ""}
      </small>
    ` : ""}
  </div>
`;

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
              RM ${order.total.toFixed(2)}
            </div>

          </div>

          <div
            class="order-details"
            id="order-${docSnap.id}"
          >

            ${itemsHTML}

            <div class="order-payment">
  ${order.payment}
  ${order.discount > 0
    ? `<br>Discount: RM ${order.discount.toFixed(2)}`
    : ""
  }
  ${order.note
    ? `<br>Note: ${order.note}`
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

  document.getElementById("todayRevenue")
    .innerText = revenue.toFixed(2);

  document.getElementById("todayOrders")
    .innerText = count;

  document.getElementById("todayDiscount")
    .innerText = discountTotal.toFixed(2);

  document.getElementById("ordersList")
    .innerHTML = ordersHTML;

  document.getElementById("topSellingToday")
    .innerHTML = renderTopSelling(topToday);

  document.getElementById("topSellingMonth")
    .innerHTML = renderTopSelling(topMonth);

  document.getElementById("topSellingAllTime")
    .innerHTML = renderTopSelling(topAllTime);
}

loadProducts();

loadDashboard();

loadClosingHistory();

  new Sortable(

  document.getElementById("products"),

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
window.toggleOrder = function(id){

  const el =
    document.getElementById(
      `order-${id}`
    );

  if(el.style.display === "block"){

    el.style.display = "none";

  }else{

    el.style.display = "block";

  }

}
window.deleteOrder = async function(id){

  const confirmDelete =
    confirm("Delete order?");

  if(!confirmDelete) return;

  await deleteDoc(
    doc(db,"orders",id)
  );

  loadDashboard();

}
window.editOrder =
async function(id){

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

  let total = 0;

  lines.forEach(line=>{

    const parts =
      line.split(",");

    const name =
      parts[0];

    const qty =
      Number(parts[1]);

    const price =
      Number(parts[2]);

   items.push({

  name,

  qty,

  price,

  milk:"Fresh Milk"

});

    total += qty * price;

  });

  const payment =
    prompt(
      "Payment Method",
      order.payment
    );

  if(payment === null) return;

  await updateDoc(

    orderRef,

    {

      items,
      total,
      payment

    }

  );

  loadDashboard();

}

document.getElementById(
  "addModifierBtn"
)
.addEventListener("click",()=>{

  const milk =
    document.getElementById(
      "milkSelect"
    ).value;

const sweet =

  document.getElementById(
    "sweetSelect"
  ).value;

const addonPrice =

  Number(

    document.getElementById(
      "addonSelect"
    ).value

  );

const addonName =

  document.getElementById(
    "addonSelect"
  )

  .selectedOptions[0]

  .text;

const note =

  document.getElementById(
    "noteInput"
  ).value;

  const ice =
    document.getElementById(
      "iceSelect"
    ).value;

  const existing =
    cart.find(i=>

      i.name === selectedProduct.name

      &&

      i.milk === milk

      &&

      i.ice === ice

    );

  if(existing){

    existing.qty += 1;

  }else{

    cart.push({

  name:selectedProduct.name,

  price:

    selectedProduct.price

    +

    addonPrice,

  qty:1,

  milk,

  ice,

  sweet,

  addon:addonName,

  note

});

  }

  renderCart();

  document.getElementById(
    "modifierModal"
  ).style.display = "none";

});

function showReceipt(order){

  const now = new Date();

  let html = `
    <div class="receipt">

      <div class="receipt-logo">
        <img src="./logo.png" alt="logo">
      </div>

      <h2>Matchalogy</h2>

<p class="receipt-sub">
  Order #${order.orderNo}
</p>

      <p class="receipt-time">
        ${now.toLocaleString()}
      </p>

      <hr>
  `;

  order.items.forEach(item=>{

    html += `
      <div class="receipt-item">

        <div>
          <strong>${item.name}</strong>

          <small>
          ${item.milk ? item.milk + " · " : ""}
${item.ice ? item.ice + " · " : ""}
${item.sweet ? item.sweet : ""}
${item.addon && item.addon !== "None" ? "<br>" + item.addon : ""}
${item.note ? "<br>Note: " + item.note : ""}
          </small>
        </div>

        <div>
          x${item.qty}<br>
          RM ${(item.price * item.qty).toFixed(2)}
        </div>

      </div>
    `;

  });

  html += `
      <hr>

      ${order.discount > 0 ? `
  <div class="receipt-total">
    <span>Discount</span>
    <strong>- RM ${order.discount.toFixed(2)}</strong>
  </div>
` : ""}

<div class="receipt-total">
  <span>Total</span>
  <strong>RM ${order.total.toFixed(2)}</strong>
</div>

      <p>Payment: ${order.payment}</p>

${order.note ? `
  <p>
    Note: ${order.note}
  </p>
` : ""}

      <p class="receipt-thanks">
        Thank you for visiting 💚
      </p>

    </div>
  `;

  document.getElementById("receiptContent").innerHTML = html;
  document.getElementById("receiptModal").style.display = "flex";
}

document.getElementById("closeReceiptBtn")
.addEventListener("click",()=>{

  document.getElementById("receiptModal").style.display = "none";

});

document.getElementById("printReceiptBtn")
.addEventListener("click",()=>{

  window.print();

});

document.getElementById("closeDayBtn")
.addEventListener("click",async()=>{

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
      new Date(
        order.time.seconds * 1000
      ).toDateString();

    if(orderDate === today){

      revenue += order.total || 0;

      discount += order.discount || 0;

      orders += 1;

      if(order.payment === "Cash"){
        cash += order.total || 0;
      }

      if(order.payment === "TNG"){
        tng += order.total || 0;
      }

      if(order.payment === "Shopee"){
        shopee += order.total || 0;
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

async function loadClosingHistory(){

  const snapshot =
    await getDocs(collection(db,"closings"));

  let html = "";
  let monthData = {};

  snapshot.forEach((docSnap)=>{

    const c =
      docSnap.data();

const date =
  new Date(c.time.seconds * 1000);

const monthKey =
  `${date.toLocaleString("default",{
    month:"long"
  })} ${date.getFullYear()}`;

if(!monthData[monthKey]){

  monthData[monthKey] = 0;

}

monthData[monthKey] +=
  c.revenue || 0;

    html += `

      <div class="closing-card">

        <strong>${c.date}</strong>

        Revenue: RM ${c.revenue.toFixed(2)}
        <br>

        Discount: RM ${c.discount.toFixed(2)}
        <br>

        Orders: ${c.orders}
        <br>

        Cash: RM ${c.cash.toFixed(2)}
        <br>

        TNG: RM ${c.tng.toFixed(2)}
        <br>

        Shopee: RM ${c.shopee.toFixed(2)}

      </div>

    `;

  });

  document.getElementById("closingHistory")
    .innerHTML = html;

let monthHTML = "";

Object.entries(monthData)
.reverse()
.forEach(([month,total])=>{

  monthHTML += `

    <div class="closing-card">

      <strong>${month}</strong>

      Revenue:
      RM ${total.toFixed(2)}

    </div>

  `;

});

document.getElementById(
  "monthlyRevenue"
).innerHTML = monthHTML;

}

document.getElementById(
  "openMonthlyBtn"
)
.addEventListener("click",()=>{

  document.getElementById(
    "monthlyModal"
  ).style.display = "flex";

});

document.getElementById(
  "closeMonthlyBtn"
)
.addEventListener("click",()=>{

  document.getElementById(
    "monthlyModal"
  ).style.display = "none";

});