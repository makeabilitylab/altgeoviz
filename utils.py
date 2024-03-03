import logging

class Section():
    # a section has left and right boundaries, and top and bottom boundaries
    def __init__(self, left, right, top, bottom, name=None):
        self.left = left
        self.right = right
        self.top = top
        self.bottom = bottom
        self.name = name
        
    def include(self, x, y):
        return self.left <= x <= self.right and self.top <= y <= self.bottom
    
    def include_polygon(self, polygon):
        if not isinstance(polygon, Polygon):
            logging.error(f"Error: include_polygon: polygon is not of type Polygon: {polygon}")
            return False
        
        return self.left <= polygon.centroid[0] <= self.right and self.top <= polygon.centroid[1] <= self.bottom
    
    def get_name(self):
        return self.name


class Polygon():
    def __init__(self, geoid, ppl_density, centroid):
        self.geoid = geoid
        self.ppl_density = ppl_density
        self.centroid = centroid
        self.section = None
    
    def set_section(self, section: Section):
        self.section = section
        
    def __str__(self):
        return f"geoid={self.geoid}, ppl_density={self.ppl_density}, centroid={self.centroid}, section={self.section}"
        
        

class Map():
    NUM_SECTIONS = 9
    FOUR_SECTION_TREND_BOUNDING_BOX = {
        ("NW", "W", "N", "C"): "NW",
        ("N", "NE", "C", "E"): "NE",
        ("W", "SW", "C", "S"): "SW",
        ("C", "E", "S", "SE"): "SE"
    }
    
    THREE_SECTION_TREND_BOUNDING_BOX = {
        ("NW", "N", "W"): "NW",
        ("W", "SW", "S"): "SW",
        ("N", "NE", "E"): "NE",
        ("S", "SE", "E"): "SE",
        ("NW", "W", "SW"): "W",
        ("NE", "E", "SE"): "E",
        ("NW", "N", "NE"): "N",
        ("SW", "S", "SE"): "S",
        ("NW", "C", "SE"): "left_diagonal",
        ("NE", "C", "SW"): "right_diagonal",
        ("W", "C", "E"): "horizontal",
        ("N", "C", "S"): "vertical"
    }
        
    
    TWO_SECTION_TREND_BOUNDING_BOX = {
        ("NW", "W"): "NW",
        ("NW", "N"): "NW",
        ("N", "NE"): "NE",
        ("NE", "E"): "NE",
        ("E", "SE"): "SE",
        ("SE", "S"): "SE",
        ("S", "SW"): "SW",
        ("SW", "W"): "SW"
    }
    
    
    FOUR_SECTION_RANK_RULE = {
        "high": [1, 2, 3, 4],
        "low": [6, 7, 8, 9]
    }
    
    THREE_SECTION_RANK_RULE = {
        "high": [
            [1, 2, 3],
            [2, 3, 4]
        ],
        "low": [
            [7, 8, 9],
            [6, 7, 8]
        ]
    }
    
    TWO_SECTION_RANK_RULE = {
        "high": [
            [1, 2],
            [2, 3],
            [3, 4]
        ],
        "low": [
            [6, 7],
            [7, 8],
            [8, 9]
        ]
    }
    
    def __init__(self, map_width, map_height):
        # initialize the map that hold the boundaries of the map sections
        self.map_width = map_width
        self.map_height = map_height
        self.cell_size = 1     # for quantization, we will use 10x10 cells
        self.map_sections = self.create_map_sections(map_width, map_height)
        self.section_lookup = self.create_section_lookup()
        
        self.polygons = []
        
        self.section_polygons = {}
        self.section_densities = {}
        self.section_ranks = {}
        
        self.trends = {
            "NW": {}, "N": {}, "NE": {}, "W": {}, "C": {}, "E": {}, "SW": {}, "S": {}, "SE": {},
            "left_diagonal": {}, "right_diagonal": {}, "horizontal": {}, "vertical": {}
            
            # "NW": {"high": (), "low": ()},
            # "N": {"high": (), "low": ()},
            # "NE": {"high": (), "low": ()},
            # "W": {"high": (), "low": ()},
            # "C": {"high": (), "low": ()},
            # "E": {"high": (), "low": ()},
            # "SW": {"high": (), "low": ()},
            # "S": {"high": (), "low": ()},
            # "SE": {"high": (), "low": ()},
            # "left_diagonal": {"high": (), "low": ()},
            # "right_diagonal": {"high": (), "low": ()},
            # "horizontal": {"high": (), "low": ()},
            # "vertical": {"high": (), "low": ()}
        }
    
    ###########################################################################
    ###### Create the map sections and the section lookup table ###############
    ###########################################################################
    def create_map_sections(self, map_width, map_height) -> list:
        # divide the map into 9 sections, split into 3 columns and 3 rows
        map_sections = [
            Section(0, map_width/3, 0, map_height/3, "NW"),
            Section(map_width/3, 2*map_width/3, 0, map_height/3, "N"),
            Section(2*map_width/3, map_width, 0, map_height/3, "NE"),
            Section(0, map_width/3, map_height/3, 2*map_height/3, "W"),
            Section(map_width/3, 2*map_width/3, map_height/3, 2*map_height/3, "C"),
            Section(2*map_width/3, map_width, map_height/3, 2*map_height/3, "E"),
            Section(0, map_width/3, 2*map_height/3, map_height, "SW"),
            Section(map_width/3, 2*map_width/3, 2*map_height/3, map_height, "S"),
            Section(2*map_width/3, map_width, 2*map_height/3, map_height, "SE")
        ]
        
        return map_sections
    
    def get_section_by_boundary_checks(self, x, y):
        for section in self.map_sections:
            if section.include(x, y):
                return section
        
        logging.error(f"Error: get_section_by_boundary_checks: x={x}, y={y}")
        return None
    
    def create_section_lookup(self):
        section_lookup = {}
        for x in range(0, self.map_width, self.cell_size):
            for y in range(0, self.map_height, self.cell_size):
                section = self.get_section_by_boundary_checks(x, y)
                # Map the quantized coordinates to the section
                if section:
                    section_lookup[(x // self.cell_size, y // self.cell_size)] = section.get_name()
                else:
                    logging.error(f"Error: create_section_lookup: x={x}, y={y}")
        return section_lookup
    
    ###########################################################################
    ######### Given one polygon, check which section it belongs to ############
    ###########################################################################
    def get_section(self, x, y):
        # Use the quantized coordinates to lookup the section
        quantized_x = x // self.cell_size
        quantized_y = y // self.cell_size
        return self.section_lookup.get((quantized_x, quantized_y))
    
    def get_section_by_centroid(self, polygon):
        x = polygon.centroid[0]
        y = polygon.centroid[1]
        return self.get_section(x, y)
    
    ##############################################################################
    #### Given a list of polygons, check which section each polygon belongs to ###
    ##############################################################################
    def set_polygons(self, polygons):
        self.polygons = polygons
        self.section_polygons = self.assign_polygons_to_sections()
        
    def assign_polygons_to_sections(self):
        section_polygons = {section.get_name(): [] for section in self.map_sections}

        for polygon in self.polygons:
            section_name = self.get_section_by_centroid(polygon)
            
            if section_name:
                polygon.set_section(section_name)
                section_polygons[section_name].append(polygon)
            else:
                logging.error(f"Polygon with centroid ({polygon.centroid[0]}, {polygon.centroid[1]}) is out of map bounds.")

        return section_polygons
    
    ##############################################################################
    ######## Calculate the average population density for each section ###########
    ##############################################################################
    def calculate_section_densities(self):
        if not self.section_polygons:
            self.section_polygons = self.assign_polygons_to_sections()
            
        section_densities = {}

        for section, polygons in self.section_polygons.items():
            if polygons:
                avg_density = sum(p.ppl_density for p in polygons) / len(polygons)
            else:
                avg_density = 0
            section_densities[section] = avg_density

        self.section_densities = section_densities
        
        
    ##############################################################################
    ######## Rank the sections by population density #############################
    ##############################################################################
    def rank_sections(self):
        if not self.section_densities:
            self.calculate_section_densities()

        # Sort the sections by density
        sorted_sections = sorted(self.section_densities.items(), key=lambda x: x[1], reverse=True)
        
        # Assign ranks to the sections
        ranked_sections = [(section, rank + 1) for rank, (section, density) in enumerate(sorted_sections)]
        
        self.section_ranks = dict(ranked_sections)
    
    def find_high_density_clusters(self):
        if not self.section_ranks:
            self.section_ranks = self.rank_sections()
        
            
        # check the four section trend first
        for bounding_box, area in self.FOUR_SECTION_TREND_BOUNDING_BOX.items():
            temp_trends = []
            for section in bounding_box:
                temp_trends.append(self.section_ranks[section])
            temp_trend = sorted(temp_trends)
            
            if temp_trend == self.FOUR_SECTION_RANK_RULE["high"]:
                self.trends[area]["high"] = bounding_box
            elif temp_trend == self.FOUR_SECTION_RANK_RULE["low"]:
                self.trends[area]["low"] = bounding_box
                
        # check the three section trend
        for bounding_box, area in self.THREE_SECTION_TREND_BOUNDING_BOX.items():
            if area not in self.trends and len(self.trends[area]) > 0:
                continue
            
            temp_trends = []
            for section in bounding_box:
                temp_trends.append(self.section_ranks[section])
            temp_trends = sorted(temp_trends)
            
            if any(temp_trends == high_trend for high_trend in self.THREE_SECTION_RANK_RULE["high"]):
                self.trends[area]["high"] = bounding_box
            elif any(temp_trends == low_trend for low_trend in self.THREE_SECTION_RANK_RULE["low"]):
                self.trends[area]["low"] = bounding_box
                
        for bounding_box, area in self.TWO_SECTION_TREND_BOUNDING_BOX.items():
            if area not in self.trends and len(self.trends[area]) > 0:
                continue
            
            temp_trends = []
            for section in bounding_box:
                temp_trends.append(self.section_ranks[section])
            temp_trends = sorted(temp_trends)
            
            if any(temp_trends == high_trend for high_trend in self.TWO_SECTION_RANK_RULE["high"]):
                self.trends[area]["high"] = bounding_box
            elif any(temp_trends == low_trend for low_trend in self.TWO_SECTION_RANK_RULE["low"]):
                self.trends[area]["low"] = bounding_box
            