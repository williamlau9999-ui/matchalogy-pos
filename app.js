import { initializeApp }
from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";

import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
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

        const existing =
          cart.find(i=>i.name===name);

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

  const total =
    cart.reduce(
      (s,i)=>s+(i.price*i.qty),
      0
    );

  await addDoc(
    collection(db,"orders"),
    {
      items:cart,
      total,
      payment:method,
      time:new Date()
    }
  );

  alert("Order Done ✅");

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
async function loadDashboard(){

  const q = query(
  collection(db,"orders"),
  orderBy("time","desc")
);

const snapshot =
  await getDocs(q);

  let revenue = 0;

  let count = 0;

  let ordersHTML = "";

  const today =
    new Date().toDateString();

  snapshot.forEach((doc)=>{

    const order = doc.data();

    const orderDate =
      new Date(
        order.time.seconds * 1000
      );

    if(
      orderDate.toDateString()
      === today
    ){

      revenue += order.total;

      count += 1;

      let itemsHTML = "";

      order.items.forEach(item=>{

        itemsHTML += `
          <div>
            ${item.name}
            x${item.qty}
          </div>
        `;

      });

     ordersHTML += `

  <div class="order-card">

    <div
      class="order-header"
      onclick="toggleOrder('${doc.id}')"
    >

      <div>

        ${orderDate.toLocaleTimeString()}

      </div>

      <div>

        RM ${order.total.toFixed(2)}

      </div>

    </div>

    <div
      class="order-details"
      id="order-${doc.id}"
    >

      ${itemsHTML}

      <div class="order-payment">

        ${order.payment}

      </div>

      <div class="order-actions">

        <button
          onclick="deleteOrder('${doc.id}')"
        >
          Delete
        </button>

        <button
          onclick="editPayment(
            '${doc.id}',
            '${order.payment}'
          )"
        >
          Edit Payment
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

  document.getElementById("ordersList")
    .innerHTML = ordersHTML;

}


loadProducts();

loadDashboard();

setTimeout(()=>{

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
window.editPayment =
async function(id,current){

  const payment =
    prompt(
      "Payment Method",
      current
    );

  if(!payment) return;

  await updateDoc(
    doc(db,"orders",id),
    {
      payment
    }
  );

  loadDashboard();

}

},1000);