//Dette programmet sjekker om det skal sendes ut notifikasjoner
//Den sjekker x ant dager fram i tid, og hvis den finner skoler med 
//som har planleggingsdag på denne datoene så sender den ut 
//notifikasjoner til de som har valgt å abbonere på varsling for 
//akkurat de skolene. Programmet er avhengig av å bli kjørt en gang pr dag 
//siden den sjekker akkurat x dager fram i tid fra dagens dato. 
//Hvis programmet ikke blir kjørt en dag så vil den gå glipp
//av en dato. Dette vil føre til at dersom det er skoler som har planleggingsdag 
//x dager fram i tid fra denne datoen, så vil ikke brukerene få notifikasjon om dette.


var fs = require('fs');
var request = require('request');
//Lager algoritme for å finne ut hvilke topics som skal motta notifikasjon
var skolerute_filbane = './skolerute-felles-2016-17.json';
var push_liste =[];
var antall_meldinger_som_skal_sendes = 0;
const varsling_dager_i_forkant = 32; //Det antall dager man vil ha varslingen i forveien.

//Leser inn skolerutedata fra json fil skolerute-felles-2016-2017.json
//og kaller de tilhørende funksjonene for å legge til skoler i varslinglisten.
//Alle funksjoner som er avhengig av json fila må trigges inne i readfile funksjonen
fs.readFile(skolerute_filbane, (err, fil_innhold) => {
    if( err ) {
      console.log("Error!! Kunne ikke lese filen");
    } else {
        rute_data = JSON.parse(fil_innhold);
        finn_neste_planleggingsdag(rute_data);  
        console.log(antall_meldinger_som_skal_sendes); 
        send_varslinger(push_liste) 
    }
})

//Funksjon som finner neste dato som skal trigge varsling. 
//Den sjekker også om dagen før var ferie slik at brukeren ikke får to notifikasjoner om samme hendelse.
//varsling_dager_i_forkant er et tall på antall dager før hendelse. Det er denne som bestemmer hvor mange dager før 
//hendelsen at brukeren skal bli varslet. 
function finn_neste_planleggingsdag(rute_data) {
    for (var i = 0; i < rute_data.data.length; i++) {
        //Starter med å sjekke om datoen er x dager fram i tid fra dagens dato.
        if(tell_dager(dagens_dato(),rute_data.data[i].dato) === varsling_dager_i_forkant){
            //Denne if setningen fanger opp det tilfellet der data[i-1] er undefined. Dette kan skje ved første runde i for loopen
            if(rute_data.data[i-1] === undefined){
                legg_til_skole_i_push_liste(rute_data.data[i]);
            }
            //Sjekker om datoen til skolene lenger ut i listen har en foregående dato.
            //Hvis dette er tilfelle så må vi sjekke om skolen har ferie
            else if (rute_data.data[i].skole === rute_data.data[i-1].skole){
                
                //Sjekker om det er ferie. hvis det er mindre enn 7 dager siden sist hendelse så antar vi at det er ferie
                var dager_i_mellom = tell_dager(rute_data.data[i-1].dato, rute_data.data[i].dato);
                if( dager_i_mellom < 7){
                    continue;
                }else{
                    legg_til_skole_i_push_liste(rute_data.data[i]);
                }
            //Hvis skolen ikke har noen foregående datoer antar vi at skolen ikke har ferie, og vi 
            //legger derfor til skolen i push_liste. (Alle datoene som har kommet hit er den første datoen 
            //til en eller annen skole og da trenger vi ikke å sjekke om det er ferie fordi det kan vi ikke vite basert 
            //på dataene vi har tilgjengelig)   
            }else{
                legg_til_skole_i_push_liste(rute_data.data[i]);
            }
        }
    }
}

//Funksjon som legger til skoler i push liste.
function legg_til_skole_i_push_liste(data){
    //bruker skolenavn uten mellomrom som firebase cloud messaging topic for skolen
    var topic = lag_fcm_topic_navn(data.skole);
    var skole_objekt = {"skole":data.skole, "dato":data.dato, "kommentar":data.kommentar, "topic":topic};
    push_liste.push(skole_objekt);
    antall_meldinger_som_skal_sendes++;
}

//Lager et date objekt som blir brukt til å hente ut dagens dato, år, mnd og dag.
function dagens_dato(){
    var dagens_dato = new Date().toISOString().slice(0, 10);
    return dagens_dato;
}

//Lager en funksjon som sjekker hvor mange dager det er i mellom dagens dato og dato i rute_data.
//Lånt fra stackoverflow: http://stackoverflow.com/questions/2627473/how-to-calculate-the-number-of-days-between-two-dates-using-javascript 
function tell_dager(dato_en, dato_to){
    var forste_dato         = lag_dato_objekt(dato_en);
    var andre_dato          = lag_dato_objekt(dato_to);
    var ant_dager           = teller(forste_dato, andre_dato);
    return ant_dager;
}

//Funksjon som teller dager i mellom to datoer.
function teller(forste_dato, andre_dato){
    var en_dag_i_millisekunder  = 24*60*60*1000;
    var antall_dager_i_mellom   = Math.round(( andre_dato.getTime()- forste_dato.getTime())/(en_dag_i_millisekunder));
    return antall_dager_i_mellom;
}

//Funksjon som lager dato objekt av en string på følgende format "2016-12-23" (år, mnd. dag).
function lag_dato_objekt(dato_string){
    var aar           = parseInt(dato_string.slice(0,4));
    var maaned        = parseInt(dato_string.slice(5,8));
    var dag           = parseInt(dato_string.slice(8,10));
    return new Date(aar, maaned, dag);
}

function lag_fcm_topic_navn(skolenavn){
    var skolenavn_uten_mellomrom = fjern_mellomrom(skolenavn);
    var skolenavn_uten_norske_tegn = fjern_norske_tegn(skolenavn_uten_mellomrom);
    return skolenavn_uten_norske_tegn;
}

//Funksjon for å fjerne mellomrom i string
//Bruker regex syntax for å finne mellomrom. s står for space
function fjern_mellomrom(skolenavn){
    var nyttSkolenavn = skolenavn.replace(/\s/g, "");
    return nyttSkolenavn;
}

//Siden topics ikke kan inneholde navn med æ, ø og å så må disse karaterene fjernes fra topic navnene.
function fjern_norske_tegn(skolenavn){
    var nyttSkolenavn1 = skolenavn.replace(/\æ/g,"ae");
    var nyttSkolenavn2 = nyttSkolenavn1.replace(/\Æ/g,"AE");
    var nyttSkolenavn3 = nyttSkolenavn2.replace(/\ø/g,"oo");
    var nyttSkolenavn4 = nyttSkolenavn3.replace(/\Ø/g,"OO");
    var nyttSkolenavn5 = nyttSkolenavn4.replace(/\å/g,"aa");
    var nyttSkolenavn6 = nyttSkolenavn5.replace(/\Å/g,"AA");
    return nyttSkolenavn6;
}

//Funksjon som sender ut varsling til alle topics i push_liste.
function send_varslinger(push_liste){
    "use strict"
    for(let skole of push_liste){
        send_melding_til_topic(skole.topic, skole.skole, skole.kommentar);
    }
}

//Firebase cloud messaging funksjon brukt til å sende notifikasjoner til brukere
//som har abbonert på topics. 
function send_melding_til_topic(topic, skole, info) {
  request({
    url: 'https://fcm.googleapis.com/fcm/send',
    method: 'POST',
    headers: {
      'Content-Type' :' application/json',
      'Authorization': 'key=AIzaSyAOrqrMsjwNdCDxpM0uDCvtV-OhCnIdVVI'
    },
    body: JSON.stringify(
    { "notification": {
        "title": skole,
        "body": info,
        "click_action": "https://skolerute.top"
    },
     "to" : '/topics/'+topic
    }
    )
  }, function(error, response, body) {
        if (error) { 
            console.error(error, response, body); 
        }
        else if (response.statusCode >= 400) { 
            console.error('HTTP Error: '+response.statusCode+' - '+response.statusMessage+'\n'+body); 
        }
        else {
            console.log('Melding sendt til brukere som er registrert på '+topic)
        }
     }
  )}



