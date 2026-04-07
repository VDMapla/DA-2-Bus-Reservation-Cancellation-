#include <iostream>
#include <vector>
#include <fstream>
#include <sstream>
#include <map>
#include <string>
#include <emscripten/bind.h>

using namespace std;

class Route {
public:
    string routeID, from, to;
    int fare, capacity;
    vector<int> seats;

    Route() {}

    Route(string id, string f, string t, int fr, int cap) {
        routeID = id;
        from = f;
        to = t;
        fare = fr;
        capacity = cap;
        seats.assign(capacity, 0);
    }

    string getID() const { return routeID; }
    int getFare() const { return fare; }
    int getCapacity() const { return capacity; }

    bool isValidSeat(int s) const {
        return (s >= 1 && s <= capacity);
    }

    bool isSeatAvailable(int s) const {
        return isValidSeat(s) && seats[s-1] == 0;
    }

    void bookSeat(int s) {
        if(isValidSeat(s)) seats[s-1] = 1;
    }

    void releaseSeat(int s) {
        if(isValidSeat(s)) seats[s-1] = 0;
    }

    void resetSeats() {
        seats.assign(capacity, 0);
    }
};

class Ticket {
public:
    string ticketID, name, routeID;
    vector<int> seats;
    int totalAmount;

    string serialize() const {
        string data = ticketID + "," + name + "," + routeID + ",";
        for(int s : seats) data += to_string(s) + "|";
        data += "," + to_string(totalAmount);
        return data;
    }
};

class ReservationSystem {
private:
    vector<Route> routes;
    vector<Ticket> tickets;
    int ticketCounter = 100;

public:
    ReservationSystem() {
        // Load default or existing routes automatically upon instantiation in JS
        loadRoutes();
        loadTickets();
    }

    void loadRoutes() {
        ifstream file("/data/routes.txt");
        if(!file) {
            routes.push_back(Route("R1","Chennai","Bangalore",500,30));
            routes.push_back(Route("R2","Chennai","Hyderabad",700,30));
            routes.push_back(Route("R3","Mumbai","Pune",300,40));
            routes.push_back(Route("R4","Delhi","Jaipur",400,20));
            saveRoutes();
            return;
        }

        string line;
        while(getline(file, line)) {
            stringstream ss(line);
            string id,f,t;
            int fare,cap;
            getline(ss,id,',');
            getline(ss,f,',');
            getline(ss,t,',');
            ss >> fare; ss.ignore();
            ss >> cap;
            routes.push_back(Route(id,f,t,fare,cap));
        }
    }

    void saveRoutes() {
        ofstream file("/data/routes.txt");
        for(auto &r : routes) {
            file << r.getID() << "," << r.from << "," << r.to << "," << r.getFare() << "," << r.getCapacity() << endl;
        }
    }

    void loadTickets() {
        ifstream file("/data/tickets.txt");
        if(!file) return;

        int maxId = 99;
        string line;
        while(getline(file,line)) {
            stringstream ss(line);
            Ticket t;
            string seatStr;

            getline(ss,t.ticketID,',');
            getline(ss,t.name,',');
            getline(ss,t.routeID,',');
            getline(ss,seatStr,',');
            ss >> t.totalAmount;

            stringstream seatSS(seatStr);
            string temp;
            while(getline(seatSS,temp,'|')) {
                if(temp != "")
                    t.seats.push_back(stoi(temp));
            }

            tickets.push_back(t);
            
            // Adjust ticket counter
            if(t.ticketID.substr(0,1) == "T") {
                int idNum = stoi(t.ticketID.substr(1));
                if(idNum > maxId) maxId = idNum;
            }
        }
        ticketCounter = maxId + 1;

        // restore seat states
        for(auto &t : tickets) {
            for(auto &r : routes) {
                if(r.getID() == t.routeID) {
                    for(int s : t.seats)
                        r.bookSeat(s);
                }
            }
        }
    }

    void saveTickets() {
        ofstream file("/data/tickets.txt");
        for(auto &t : tickets)
            file << t.serialize() << endl;
    }

    int findRouteIndex(string id) {
        for(int i=0;i<(int)routes.size();i++)
            if(routes[i].getID()==id)
                return i;
        return -1;
    }

    // JSON API For WASM

    string getRoutesJSON() {
        string json = "[";
        for(size_t i=0; i<routes.size(); i++) {
            json += "{\"id\":\"" + routes[i].getID() + "\",\"from\":\"" + routes[i].from + "\",\"to\":\"" + routes[i].to + "\",\"fare\":" + to_string(routes[i].getFare()) + ",\"capacity\":" + to_string(routes[i].getCapacity());
            
            json += ",\"seats\":[";
            for(int s=1; s<=routes[i].getCapacity(); s++) {
                json += (routes[i].isSeatAvailable(s) ? "0" : "1");
                if(s < routes[i].getCapacity()) json += ",";
            }
            json += "]}";
            
            if(i < routes.size()-1) json += ",";
        }
        json += "]";
        return json;
    }

    string bookTicket(string name, string rid, vector<int> chosenSeats) {
        int idx = findRouteIndex(rid);
        if(idx == -1) return "{\"error\":\"Invalid route!\"}";

        if(chosenSeats.size() == 0) return "{\"error\":\"No seats selected!\"}";

        for(int s : chosenSeats) {
            if(!routes[idx].isValidSeat(s)) return "{\"error\":\"Invalid seat selected!\"}";
            if(!routes[idx].isSeatAvailable(s)) return "{\"error\":\"Seat " + to_string(s) + " is already booked!\"}";
        }

        for(int s : chosenSeats) {
            routes[idx].bookSeat(s);
        }

        Ticket t;
        t.ticketID = "T" + to_string(ticketCounter++);
        t.name = name;
        t.routeID = rid;
        t.seats = chosenSeats;
        t.totalAmount = chosenSeats.size() * routes[idx].getFare();

        tickets.push_back(t);
        saveTickets(); // update file

        return "{\"success\":true, \"ticketID\":\"" + t.ticketID + "\", \"total\":" + to_string(t.totalAmount) + "}";
    }

    string cancelTicket(string id) {
        for(size_t i=0; i<tickets.size(); i++) {
            if(tickets[i].ticketID == id) {
                int idx = findRouteIndex(tickets[i].routeID);
                if(idx != -1) {
                    for(int s : tickets[i].seats)
                        routes[idx].releaseSeat(s);
                }
                tickets.erase(tickets.begin()+i);
                saveTickets();
                return "{\"success\":true}";
            }
        }
        return "{\"error\":\"Ticket not found!\"}";
    }

    string searchTicket(string id) {
        for(auto &t : tickets) {
            if(t.ticketID == id) {
                string json = "{\"ticketID\":\"" + t.ticketID + "\",\"name\":\"" + t.name + "\",\"routeID\":\"" + t.routeID + "\",\"totalAmount\":" + to_string(t.totalAmount) + ",\"seats\":[";
                for(size_t i=0; i<t.seats.size(); i++) {
                    json += to_string(t.seats[i]);
                    if(i < t.seats.size()-1) json += ",";
                }
                json += "]}";
                return json;
            }
        }
        return "{\"error\":\"Ticket not found!\"}";
    }

    string getReportsJSON() {
        map<string,int> revenue, count;
        for(auto &t : tickets) {
            revenue[t.routeID] += t.totalAmount;
            count[t.routeID]++;
        }

        string json = "[";
        for(size_t i=0; i<routes.size(); i++) {
            json += "{\"routeID\":\"" + routes[i].getID() + "\",\"revenue\":" + to_string(revenue[routes[i].getID()]) + ",\"tickets\":" + to_string(count[routes[i].getID()]) + "}";
            if(i < routes.size()-1) json += ",";
        }
        json += "]";
        return json;
    }
};

// Emscripten Binding configuration
EMSCRIPTEN_BINDINGS(bus_reservation) {
    emscripten::class_<ReservationSystem>("ReservationSystem")
        .constructor<>()
        .function("getRoutesJSON", &ReservationSystem::getRoutesJSON)
        .function("bookTicket", &ReservationSystem::bookTicket)
        .function("cancelTicket", &ReservationSystem::cancelTicket)
        .function("searchTicket", &ReservationSystem::searchTicket)
        .function("getReportsJSON", &ReservationSystem::getReportsJSON)
        .function("loadTickets", &ReservationSystem::loadTickets)
        .function("saveTickets", &ReservationSystem::saveTickets);
    
    emscripten::register_vector<int>("VectorInt");
}
