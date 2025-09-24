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
        let events = data.map(r => ({
          id: r.id,
          title: `${r.room} - ${r.user_name}`,
          start: `${r.date}T${r.start_time}`,
          end: `${r.date}T${r.end_time}`,
          backgroundColor: "#c2d500",
          borderColor: "#265d73",
          extendedProps: {
            horaInicio: r.start_time,
            horaFin: r.end_time
          }
        }));
        successCallback(events);
      } catch (err) {
        failureCallback(err);
      }
    },

    eventDidMount: function(info) {
      // Tooltip personalizado
      info.el.addEventListener("mouseenter", (e) => {
        tooltip.innerHTML = `
          <b>${info.event.title}</b><br>
          Inicio: ${info.event.extendedProps.horaInicio}<br>
          Fin: ${info.event.extendedProps.horaFin}
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
    li.textContent = `${r.room} - ${r.date} ${r.start_time} a ${r.end_time} `;

    let btn = document.createElement("button");
    btn.textContent = "Eliminar";
    btn.onclick = async () => {
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

    li.appendChild(btn);
    lista.appendChild(li);
  });

  document.getElementById("misReservas").style.display = "block";
}

function cerrarMisReservas() {
  document.getElementById("misReservas").style.display = "none";
}
