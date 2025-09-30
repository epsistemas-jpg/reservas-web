document.addEventListener("DOMContentLoaded", function () {
  const calendarEl = document.getElementById("calendar");
  const calendar = new FullCalendar.Calendar(calendarEl, {
    initialView: "dayGridMonth",
    locale: "es",
    eventDisplay: "block",
    eventTimeFormat: {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    },

    events: async function (fetchInfo, successCallback, failureCallback) {
      try {
        let res = await fetch("/api/reservations");
        let data = await res.json();
        let events = data.map(r => {
          let color = "#3a87ad"; // color por defecto

          if (r.room === "Bocas de ceniza") {
            color = "#f39c12"; // naranja
          } else if (r.room === "Rio Magdalena") {
            color = "#27ae60"; // verde
          } else if (r.room === "Piso 1109") {
            color = "#3a87ad"; 
          }

          return {
            id: r.id,
            title: `${r.room} - ${r.user_name}`,
            start: `${r.date}T${r.start_time}`,
            end: `${r.date}T${r.end_time}`,
            color: color,
            extendedProps: {
              horaInicio: r.start_time,
              horaFin: r.end_time,
              motivo: r.motivo
            }
          };
        });

        successCallback(events);
      } catch (err) {
        failureCallback(err);
      }
    },

    eventDidMount: function(info) {
      info.el.addEventListener("mouseenter", (e) => {
        tooltip.innerHTML = `
          <b>${info.event.title}</b><br>
          Inicio: ${info.event.extendedProps.horaInicio}<br>
          Fin: ${info.event.extendedProps.horaFin}
          <br>Motivo: ${info.event.extendedProps.motivo}
        `;
        tooltip.style.display = "block";
        tooltip.style.left = e.pageX + 10 + "px";
        tooltip.style.top = e.pageY + 10 + "px";
      });

      info.el.addEventListener("mousemove", (e) => {
        tooltip.style.left = e.pageX + 10 + "px";
        tooltip.style.top = e.pageY + 10 + "px";
      });

      info.el.addEventListener("mouseleave", () => {
        tooltip.style.display = "none";
      });
    }
  });

  calendar.render();

  // Crear div tooltip si no existe
  let tooltip = document.createElement("div");
  tooltip.className = "fc-tooltip";
  document.body.appendChild(tooltip);

  // Modal nueva reserva
  const newReservaForm = document.getElementById("newReservaForm");
  newReservaForm.addEventListener("submit", async function (e) {
    e.preventDefault();
    const formData = new FormData(newReservaForm);
    const data = Object.fromEntries(formData);

    let res = await fetch("/api/reservations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });

    if (res.ok) {
      Swal.fire({
        icon: "success",
        title: "Reserva creada",
        text: "Tu sala quedó reservada exitosamente",
        timer: 2000,
        showConfirmButton: false
      }).then(() => {
        cerrarFormulario();
        calendar.refetchEvents();
      });
    } else {
      let msg = await res.text();
      Swal.fire({
        icon: "error",
        title: "No se pudo crear la reserva",
        text: msg
      });
    }
  });
});

// Abrir y cerrar formularios
function mostrarFormulario() {
  document.getElementById("reservaForm").style.display = "block";
}
function cerrarFormulario() {
  document.getElementById("reservaForm").style.display = "none";
}

async function mostrarMisReservas() {
  const res = await fetch("/api/myreservations");
  const data = await res.json();
  const lista = document.getElementById("listaMisReservas");
  lista.innerHTML = "";

  data.forEach(r => {
    let li = document.createElement("li");
    const fecha = new Date(r.date);
    const fechaFormateada = fecha.toLocaleDateString("es-CO");
    li.textContent = `${r.room} - ${fechaFormateada} ${r.start_time} a ${r.end_time} `;

    // Botón Eliminar
    let btnEliminar = document.createElement("button");
    btnEliminar.textContent = "Eliminar";
    btnEliminar.onclick = async () => {
      Swal.fire({
        title: "¿Eliminar reserva?",
        text: `Se eliminará la reserva de ${r.room}`,
        icon: "warning",
        showCancelButton: true,
        confirmButtonColor: "#d33",
        cancelButtonColor: "#9fac10ff",
        confirmButtonText: "Sí, eliminar",
        cancelButtonText: "Cancelar"
      }).then(async (result) => {
        if (result.isConfirmed) {
          let resp = await fetch(`/api/reservations/${r.id}`, { method: "DELETE" });
          if (resp.ok) {
            Swal.fire({
              icon: "success",
              title: "Eliminada",
              text: "La reserva fue eliminada",
              timer: 2000,
              showConfirmButton: false
            });
            mostrarMisReservas();
            location.reload();
          } else {
            Swal.fire({
              icon: "error",
              title: "Error",
              text: "No se pudo eliminar la reserva"
            });
          }
        }
      });
    };

    // Botón Editar
    let btnEditar = document.createElement("button");
    btnEditar.textContent = "Editar";
    btnEditar.onclick = () => editarReserva(r);

    li.appendChild(btnEditar);
    li.appendChild(btnEliminar);
    lista.appendChild(li);
  });

  document.getElementById("misReservas").style.display = "block";
}

function cerrarMisReservas() {
  document.getElementById("misReservas").style.display = "none";
}

function editarReserva(reserva) {
  const form = document.getElementById("editReservaForm");
  form.querySelector("[name='id']").value = reserva.id;
  form.querySelector("[name='room']").value = reserva.room;
  form.querySelector("[name='date']").value = reserva.date;
  form.querySelector("[name='start_time']").value = reserva.start_time;
  form.querySelector("[name='end_time']").value = reserva.end_time;
  form.querySelector("[name='motivo']").value = reserva.motivo || "";

  document.getElementById("editarReservaForm").style.display = "block";
}

function cerrarEditar() {
  document.getElementById("editarReservaForm").style.display = "none";
}

// Guardar edición
document.getElementById("editReservaForm").addEventListener("submit", async function(e) {
  e.preventDefault();

  const data = Object.fromEntries(new FormData(this));

  let resp = await fetch(`/api/reservations/${data.id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  });

  if (resp.ok) {
    Swal.fire({
      icon: "success",
      title: "Editada",
      text: "La reserva fue actualizada correctamente",
      timer: 2000,
      showConfirmButton: false
    });
    cerrarEditar();
    mostrarMisReservas();
    calendar.refetchEvents();
  } else {
    let err = await resp.text();
    Swal.fire({
      icon: "error",
      title: "Error",
      text: err || "No se pudo editar la reserva"
    });
  }
});
